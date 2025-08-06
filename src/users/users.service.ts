import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, Req, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { PendingUser, PendingUserDocument, UserDocument } from './entities/user.schema';
import ApiResponse from 'src/common/helpers/api-response';
import { SignUpDto } from './dto/sign-up.dto';
import { MailService } from 'src/mail/mail.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { LoginOtpDto } from './dto/login-otp.dto';
import { LoginByOtpDto } from './dto/login-by-otp.dto';
import { v4 as uuidv4 } from 'uuid';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SmsService } from 'src/sms/sms.service';
import { TokenService } from 'src/token/token.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ActivityLogsService } from 'src/activity_logs/activity_logs.service';
import { OtpService } from 'src/otp/otp.service';
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PendingUser.name) private pendingUserModel: Model<PendingUserDocument>,
    private mailService: MailService,
    private smsService: SmsService,
    private tokenService: TokenService,
    private cloudinaryService: CloudinaryService,
    private activityLogService: ActivityLogsService,
    private otpService: OtpService
  ) { }

  private getContactType(contact: string) {
    const isEmail = contact.includes("@");
    return isEmail ? "email" : "contactNumber";
  }

  private async getPendingUser(email: string, contactNumber: number): Promise<PendingUserDocument | null> {

    const pendingUser = await this.pendingUserModel.findOne({
      $or: [
        {
          email
        },
        {
          contactNumber
        }
      ]
    })

    return pendingUser;

  }

  async signUp(signUpDto: SignUpDto): Promise<ApiResponse<any>> {

    const existingUser = await this.userModel.findOne({
      $or: [
        {
          email: signUpDto.email
        },
        {
          contactNumber: signUpDto.contactNumber
        }
      ]
    });

    const pendingUser = await this.getPendingUser(signUpDto.email, signUpDto.contactNumber);

    if (existingUser || pendingUser) {
      if (existingUser?.email === signUpDto.email) {
        throw new HttpException("An user already exist with same email!", HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException("An user already exist with same contact number!", HttpStatus.BAD_REQUEST)
      }
    }
    const newPendingUser = new this.pendingUserModel({
      ...signUpDto
    });

    await newPendingUser.save();

    const emailOtp = await this.otpService.createOtp("SIGN_UP", signUpDto.email, newPendingUser?._id)
    const contactOtp = await this.otpService.createOtp("SIGN_UP", signUpDto.contactNumber.toString(), newPendingUser?._id)

    await this.mailService.sendOtpEmail(signUpDto?.email, emailOtp);
    await this.smsService.sendVerificationOtpSms(contactOtp);

    await this.activityLogService.logActivity({
      message: "New user signed up.",
      action: "SIGN_UP",
      userId: newPendingUser?._id
    });

    return new ApiResponse<any>(true, "User signed up successfully", HttpStatus.CREATED);

  }

  async verifyUser(verifyEmailDto: VerifyEmailDto): Promise<ApiResponse<any>> {

    const user : any = await this.userModel.findOne({
      email: verifyEmailDto?.email,
      contactNumber: Number(verifyEmailDto?.contactNumber)
    });

    const pendingUser = await this.getPendingUser(verifyEmailDto?.email, verifyEmailDto?.contactNumber);

    if (!user && !pendingUser) {
      throw new HttpException("User not found!", HttpStatus.UNAUTHORIZED)
    }

    if (user) {
      throw new HttpException("User already verified!", HttpStatus.BAD_REQUEST)
    }

    const isEmailOtpVerified = await this.otpService.verifyOtp(verifyEmailDto.emailOtp,"SIGN_UP",verifyEmailDto.email);
    const isContactOtpVerified = await this.otpService.verifyOtp(verifyEmailDto.contactOtp,"SIGN_UP",verifyEmailDto.contactNumber.toString());
    
    if (!isEmailOtpVerified && !isContactOtpVerified) {
      throw new HttpException("Can't verify account as none of the otp is valid!", HttpStatus.UNAUTHORIZED)
    }

    const {name,email,password,contactNumber,_id} = pendingUser as any ;

    await this.userModel.create({
      name,
      email,
      password,
      contactNumber,
      isEmailVerified : isEmailOtpVerified, 
      isContactNumberVerified: isContactOtpVerified
    });

    await this.pendingUserModel.findByIdAndDelete(_id);

    await this.activityLogService.logActivity({
      message : "User verified the account.",
      action : "ACCOUNT_VERIFICATION",
      userId : user?._id
    })

    return new ApiResponse<any>(true, "User verified successfully", HttpStatus.OK);

  }

  async login(loginDto: LoginDto): Promise<ApiResponse<any>> {

    const isContactTypeEmail = this.getContactType(loginDto.contact) === "email";

    const pendingUser = await this.getPendingUser(isContactTypeEmail ? loginDto.contact : "", isContactTypeEmail ? 1 : Number(loginDto.contact));

    if (pendingUser) {
      throw new HttpException("Please verify your account first using the otp!", HttpStatus.FORBIDDEN)
    }

    const query = isContactTypeEmail ? { email: loginDto.contact } : { contactNumber: loginDto.contact };

    const user: any = await this.userModel.findOne(query).select("name email contactNumber profilePic isEmailVerified isContactNumberVerified password");

    if (!user) {
      throw new HttpException("Please login with right credentials!", HttpStatus.UNAUTHORIZED)
    }

    const isPasswordCorrect = await user.isPasswordCorrect(loginDto.password);

    if (!isPasswordCorrect) {
      throw new HttpException("Please login with right credentials!", HttpStatus.UNAUTHORIZED)
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(user?._id),
      this.tokenService.generateRefreshToken(user?._id),
    ])

    user.refreshToken = refreshToken;

    await user.save();

    user.password = undefined;
    user.emailOtpExpiry = undefined;
    user.contactOtpExpiry = undefined;

    await this.activityLogService.logActivity({
      message : "User logged in by password.",
      action : "PASSWORD_LOGIN",
      userId : user?._id
    })

    return new ApiResponse<User>(true, "User logged in successfully!", HttpStatus.OK, { user, accessToken, refreshToken })


  }

  async generateLoginOtp(loginOtpDto: LoginOtpDto): Promise<ApiResponse<any>> {

    const isContactTypeEmail = this.getContactType(loginOtpDto.contact) === "email";

    const pendingUser = await this.getPendingUser(isContactTypeEmail ? loginOtpDto.contact : "", isContactTypeEmail ? 1 : Number(loginOtpDto.contact));

    if (pendingUser) {
      throw new HttpException("Please verify your account first using the otp!", HttpStatus.FORBIDDEN)
    }

    const query = isContactTypeEmail ? { email: loginOtpDto.contact } : { contactNumber: loginOtpDto.contact };

    const user: any = await this.userModel.findOne(query).select("name email contactNumber profilePic isEmailVerified isContactNumberVerified password");

    if (!user) {
      throw new HttpException("User doesn't exist with this contact!", HttpStatus.UNAUTHORIZED)
    }

    const loginOtp = await this.otpService.createOtp("LOGIN",loginOtpDto.contact,user._id);

    if (isContactTypeEmail) {
      await this.mailService.sendLoginOtpEmail(loginOtpDto.contact, loginOtp);
    } else {
      await this.smsService.sendLoginOtpSms(loginOtp);
    }

    await this.activityLogService.logActivity({
      message : "Login OTP created.",
      action : "LOGIN_OTP_CREATED",
      userId : user?._id
    })

    return new ApiResponse<any>(
      true,
      `Login otp has been sent to your ${isContactTypeEmail ? "email" : "mobile number"} successfully!`,
      HttpStatus.CREATED,
      null
    );

  }

  async loginByOtp(loginByOtpDto: LoginByOtpDto): Promise<ApiResponse<any>> {

    const isContactTypeEmail = this.getContactType(loginByOtpDto.contact) === "email";
    
    const contactType = this.getContactType(loginByOtpDto.contact) === "email" ? "email" : "mobile number";
    
    const pendingUser = await this.getPendingUser(isContactTypeEmail ? loginByOtpDto.contact : "", isContactTypeEmail ? 1 : Number(loginByOtpDto.contact));
    
    if (pendingUser) {
      throw new HttpException("Please verify your account first using the otp!", HttpStatus.FORBIDDEN)
    }
    
    const query = isContactTypeEmail ? { email: loginByOtpDto.contact } : { contactNumber: loginByOtpDto.contact };

    const user = await this.userModel.findOne(query).select("-password -otp -otpExpiryTime");

    if (!user) {
      throw new HttpException(`User doesn't exist with this ${contactType}!`, HttpStatus.BAD_REQUEST)
    }

    const isOtpVerified = await this.otpService.verifyOtp(loginByOtpDto.otp,"LOGIN",loginByOtpDto.contact);

    if(!isOtpVerified){
      throw new UnauthorizedException("Invalid OTP!");
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(user?._id),
      this.tokenService.generateRefreshToken(user?._id),
    ])

    user.refreshToken = refreshToken;

    await user.save();

    await this.activityLogService.logActivity({
      message : "User logged in by otp.",
      action : "OTP_LOGIN",
      userId : user?._id
    })

    return new ApiResponse<any>(
      true,
      "User logged in successfully!",
      HttpStatus.OK,
      {
        user, accessToken, refreshToken
      }
    );

  }

  async generateForgetPasswordOtp(forgetPasswordDto: LoginOtpDto): Promise<ApiResponse<any>> {

    const isContactTypeEmail = this.getContactType(forgetPasswordDto.contact) === "email";

    const query = isContactTypeEmail ? { email: forgetPasswordDto.contact } : { contactNumber: forgetPasswordDto.contact };

    const pendingUser = await this.getPendingUser(isContactTypeEmail ? forgetPasswordDto.contact : "", isContactTypeEmail ? 1 : Number(forgetPasswordDto.contact));
    
    if (pendingUser) {
      throw new HttpException("Please verify your account first using the otp!", HttpStatus.FORBIDDEN)
    }

    const user = await this.userModel.findOne(query).select("-password");
    
    const contactType = this.getContactType(forgetPasswordDto.contact) === "email" ? "email" : "mobile number";

    if (!user) {
      throw new HttpException(`User doesn't exist with this ${contactType}!`, HttpStatus.BAD_REQUEST)
    }

    const forgetPasswordOtp = await this.otpService.createOtp('RESET_PASSWORD',forgetPasswordDto.contact,user?._id);

    if (isContactTypeEmail) {
      await this.mailService.sendForgetPasswordOtpEmail(forgetPasswordDto.contact, forgetPasswordOtp);
    } else {
      await this.smsService.sendForgetPasswordOtpSms(forgetPasswordOtp);
    }

    await this.activityLogService.logActivity({
      message : "OTP is sent to reset the password.",
      action : "RESET_PASSWORD_OTP_SENT",
      userId : user?._id
    })

    return new ApiResponse<any>(
      true,
      "Otp has been sent to reset password !",
      HttpStatus.CREATED,
      null
    );

  }

  async verifyForgetPasswordOtp(verifyResetPasswordDto: LoginByOtpDto): Promise<ApiResponse<any>> {

    const isContactTypeEmail = this.getContactType(verifyResetPasswordDto.contact) === "email";

    const query = isContactTypeEmail ? { email: verifyResetPasswordDto.contact } : { contactNumber: verifyResetPasswordDto.contact };

    const pendingUser = await this.getPendingUser(isContactTypeEmail ? verifyResetPasswordDto.contact : "", isContactTypeEmail ? 1 : Number(verifyResetPasswordDto.contact));
    
    if (pendingUser) {
      throw new HttpException("Please verify your account first using the otp!", HttpStatus.FORBIDDEN)
    }

    const user = await this.userModel.findOne(query).select("-password");
    
    const contactType = this.getContactType(verifyResetPasswordDto.contact) === "email" ? "email" : "mobile number";

    if (!user) {
      throw new HttpException(`User doesn't exist with this ${contactType}!`, HttpStatus.BAD_REQUEST)
    }

    const isOtpVerified = await this.otpService.verifyOtp(verifyResetPasswordDto.otp,"RESET_PASSWORD",verifyResetPasswordDto.contact);

    if(!isOtpVerified){
      throw new UnauthorizedException("Invalid otp!");
    }

    const resetPasswordToken = uuidv4();

    await this.userModel.findOneAndUpdate(
      query,
      {
        $set: {
          resetPasswordToken
        }
      }
    );

    await this.activityLogService.logActivity({
      message : "OTP is verified. So user get the authority to reset password.",
      action : "RESET_PASSWORD_TOKEN_SENT",
      userId : user?._id
    })

    return new ApiResponse<any>(
      true,
      "Otp verified!",
      HttpStatus.OK,
      {
        token: resetPasswordToken
      }
    );

  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<ApiResponse<any>> {

    const user: any = await this.userModel.findOne({
      resetPasswordToken: resetPasswordDto.token
    });

    if (!user) {
      throw new HttpException("Unauthorized request!", HttpStatus.UNAUTHORIZED);
    }

    user.password = await bcrypt.hash(resetPasswordDto.password,10);
    user.resetPasswordToken = null ;

    await user.save();

    await this.activityLogService.logActivity({
      message : "User has changed the password.",
      action : "RESET_PASSWORD",
      userId : user?._id
    })

    return new ApiResponse<any>(
      true,
      "Password has been reset!",
      HttpStatus.OK
    );

  }

  async getUserProfileInfo(request): Promise<ApiResponse<any>> {

    const { _id , name, email, contactNumber, isVerified, profilePic, role, isEmailVerified, isContactNumberVerified } = request?.user;

    const user = {
      _id,
      name,
      email,
      contactNumber,
      isVerified,
      profilePic,
      role,
      isEmailVerified, isContactNumberVerified 
    }

    return new ApiResponse(
      true,
      "User profile fetched successfully",
      HttpStatus.OK,
      user
    )

  }

  async uploadProfilePic(request, profilePicFile: Express.Multer.File): Promise<ApiResponse<any>> {

    if (!profilePicFile) {
      throw new BadRequestException("Profile pic is required!");
    }

    const cloudFile = await this.cloudinaryService.uploadFile(profilePicFile);

    if (!cloudFile || !cloudFile?.secure_url || !cloudFile?.public_id) {
      throw new InternalServerErrorException("File uploading failed!");
    }

    if (request.user?.profilePic) {
      await this.cloudinaryService.deleteFile(request.user?.profilePicPublicId);
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      request?.user?._id,
      {
        $set: {
          profilePic: cloudFile?.secure_url,
          profilePicPublicId: cloudFile?.public_id
        }
      },
      {
        new: true
      }
    ).select("name email contactNumber isVerified profilePic");

    await this.activityLogService.logActivity({
      message : "User changed their profile picture.",
      action : "PROFILE_PIC_CHANGED",
      userId : updatedUser?._id
    })

    return new ApiResponse(
      true,
      "Profile picture uploaded successfully",
      HttpStatus.OK,
      updatedUser
    )

  }

  async refreshAccessToken(refreshTokenDto: RefreshTokenDto): Promise<ApiResponse<any>> {

    const payload: any = await this.tokenService.verifyRefeshToken(refreshTokenDto?.refreshToken);

    const user = await this.userModel.findOne({
      _id: payload?._id,
      refreshToken: refreshTokenDto.refreshToken
    });

    if (!user) {
      throw new UnauthorizedException("Unauthorized request!");
    }

    const accessToken = await this.tokenService.generateAccessToken(user?._id);

    return new ApiResponse(
      true,
      "Access token refreshed successfully",
      HttpStatus.OK,
      { accessToken }
    )

  }

  async logout(@Req() request): Promise<ApiResponse<any>> {

    const user = await this.userModel.findByIdAndUpdate(
      request?.user?._id,
      {
        $set: {
          refreshToken: ""
        }
      }
    );

    await this.activityLogService.logActivity({
      message : "User logged out.",
      action : "LOGOUT",
      userId : user?._id
    })

    return new ApiResponse(
      true,
      "User logged out successfully",
      HttpStatus.OK
    )

  }

}