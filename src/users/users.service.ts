import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, Req, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { UserDocument } from './entities/user.schema';
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

@Injectable()
export class UsersService {

  private otpStore = new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mailService: MailService,
    private smsService: SmsService,
    private tokenService: TokenService,
    private cloudinaryService: CloudinaryService
  ) { }

  private generateRandomOtp() {
    return Math.floor(1000 + Math.random() * 9000);
  }

  private getContactType(contact: string) {
    const isEmail = contact.includes("@");
    return isEmail ? "email" : "contactNumber";
  }

  async signUp(signUpDto: SignUpDto): Promise<ApiResponse<any>> {

    try {

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

      if (existingUser) {
        if (existingUser?.email === signUpDto.email) {
          throw new HttpException("An user already exist with same email!", HttpStatus.BAD_REQUEST)
        } else {
          throw new HttpException("An user already exist with same contact number!", HttpStatus.BAD_REQUEST)
        }
      }

      const emailOtp = this.generateRandomOtp();
      const contactOtp = this.generateRandomOtp();

      const newUser: any = new this.userModel({
        ...signUpDto,
        emailOtp,
        contactOtp
      });

      await newUser.save();

      await this.mailService.sendOtpEmail(signUpDto?.email, emailOtp);
      await this.smsService.sendVerificationOtpSms(contactOtp);

      return new ApiResponse<any>(true, "User signed up successfully", HttpStatus.CREATED);

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async verifyUser(verifyEmailDto: VerifyEmailDto): Promise<ApiResponse<any>> {

    try {

      const user = await this.userModel.findOne({
        email: verifyEmailDto?.email,
        contactNumber: Number(verifyEmailDto?.contactNumber)
      });

      if (!user) {
        throw new HttpException("User not found!", HttpStatus.UNAUTHORIZED)
      }

      if (user?.isVerified) {
        throw new HttpException("User already verified!", HttpStatus.BAD_REQUEST)
      }

      if (user?.emailOtp !== Number(verifyEmailDto?.emailOtp) || user?.emailOtpExpiry < Date.now()) {
        throw new HttpException("Invalid Email OTP!", HttpStatus.UNAUTHORIZED)
      }

      if (user?.contactOtp !== Number(verifyEmailDto?.contactOtp) || user?.contactOtpExpiry < Date.now()) {
        throw new HttpException("Invalid Mobile Number OTP!", HttpStatus.UNAUTHORIZED)
      }

      await this.userModel.findOneAndUpdate(
        {
          ...verifyEmailDto
        },
        {
          $set: {
            isVerified: true,
            emailOtp: null,
            emailOtpExpiry: Date.now(),
            contactOtp: null,
            contactOtpExpiry: Date.now(),
          }
        }
      );

      return new ApiResponse<any>(true, "User verified successfully", HttpStatus.OK);

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async login(loginDto: LoginDto): Promise<ApiResponse<any>> {

    try {

      const isContactTypeEmail = this.getContactType(loginDto.contact) === "email";

      const query = isContactTypeEmail ? { email: loginDto.contact } : { contactNumber: loginDto.contact };

      const user: any = await this.userModel.findOne({
        ...query,
        $or: [
          {
            emailOtpExpiry: {
              $gt: Date.now()
            },
            contactOtpExpiry: {
              $gt: Date.now()
            }
          },
          {
            isVerified: true
          }
        ]

      }).select("name email contactNumber profilePic isVerified emailOtpExpiry contactOtpExpiry password");

      console.log(user)

      if (!user) {
        console.log("user not found")
        throw new HttpException("Please login with right credentials!", HttpStatus.UNAUTHORIZED)
      }

      if (!user?.isVerified && user?.emailOtpExpiry > Date.now() && user?.contactOtpExpiry > Date.now()) {
        throw new HttpException("Please verify the email first using the otp!", HttpStatus.FORBIDDEN)
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

      return new ApiResponse<User>(true, "User logged in successfully!", HttpStatus.OK, { user, accessToken, refreshToken })

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async generateLoginOtp(loginOtpDto: LoginOtpDto): Promise<ApiResponse<any>> {

    try {

      const isContactTypeEmail = this.getContactType(loginOtpDto.contact) === "email";

      const query = isContactTypeEmail ? { email: loginOtpDto.contact } : { contactNumber: loginOtpDto.contact };

      const user = await this.userModel.findOne({
        ...query,
        $or: [
          {
            emailOtpExpiry: {
              $gt: Date.now()
            },
            contactOtpExpiry: {
              $gt: Date.now()
            }
          },
          {
            isVerified: true
          }
        ]
      });

      if (!user) {
        throw new HttpException("User doesn't exist with this contact!", HttpStatus.BAD_REQUEST)
      }

      const loginOtp = this.generateRandomOtp();

      if (isContactTypeEmail) {
        await this.mailService.sendLoginOtpEmail(loginOtpDto.contact, loginOtp);
      } else {
        await this.smsService.sendLoginOtpSms(loginOtp);
      }

      const optDetails = {
        contact: loginOtpDto.contact,
        otp: loginOtp,
        expiry: Date.now() + 300000
      }

      this.otpStore.set(loginOtpDto.contact, optDetails);

      return new ApiResponse<any>(
        true,
        `Login otp has been sent to your ${isContactTypeEmail ? "email" : "mobile number"} successfully!`,
        HttpStatus.CREATED,
        null
      );

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async loginByOtp(loginByOtpDto: LoginByOtpDto): Promise<ApiResponse<any>> {

    try {

      const otpDetails = this.otpStore.get(loginByOtpDto.contact);

      if (
        !otpDetails ||
        otpDetails.otp !== Number(loginByOtpDto?.otp) ||
        otpDetails?.expiry < Date.now()
      ) {
        throw new HttpException("Invalid OTP!", HttpStatus.UNAUTHORIZED);
      }

      const isContactTypeEmail = this.getContactType(loginByOtpDto.contact) === "email";

      const query = isContactTypeEmail ? { email: loginByOtpDto.contact } : { contactNumber: loginByOtpDto.contact };

      const user = await this.userModel.findOne({
        ...query,
        $or: [
          {
            emailOtpExpiry: {
              $gt: Date.now()
            },
            contactOtpExpiry: {
              $gt: Date.now()
            }
          },
          {
            isVerified: true
          }
        ]
      }).select("-password -otp -otpExpiryTime");

      const contactType = this.getContactType(loginByOtpDto.contact) === "email" ? "email" : "mobile number";

      if (!user) {
        throw new HttpException(`User doesn't exist with this ${contactType}!`, HttpStatus.BAD_REQUEST)
      }

      this.otpStore.delete(loginByOtpDto.contact);

      const [accessToken, refreshToken] = await Promise.all([
        this.tokenService.generateAccessToken(user?._id),
        this.tokenService.generateRefreshToken(user?._id),
      ])

      user.refreshToken = refreshToken;

      await user.save();

      return new ApiResponse<any>(
        true,
        "User logged in successfully!",
        HttpStatus.OK,
        {
          user, accessToken, refreshToken
        }
      );

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async generateForgetPasswordOtp(forgetPasswordDto: LoginOtpDto): Promise<ApiResponse<any>> {
    try {

      const isContactTypeEmail = this.getContactType(forgetPasswordDto.contact) === "email";

      const query = isContactTypeEmail ? { email: forgetPasswordDto.contact } : { contactNumber: forgetPasswordDto.contact };

      const user = await this.userModel.findOne({
        ...query,
        $or: [
          {
            emailOtpExpiry: {
              $gt: Date.now()
            },
            contactOtpExpiry: {
              $gt: Date.now()
            }
          },
          {
            isVerified: true
          }
        ]
      });

      if (!user) {
        throw new HttpException(`User doesn't exist with this ${isContactTypeEmail ? "email" : "contact number"}!`, HttpStatus.BAD_REQUEST)
      }

      const forgetPasswordOtp = this.generateRandomOtp();

      const optDetails = {
        contact: forgetPasswordDto.contact,
        otp: forgetPasswordOtp,
        expiry: Date.now() + 300000
      }

      this.otpStore.set(forgetPasswordDto.contact, optDetails);

      if (isContactTypeEmail) {
        await this.mailService.sendForgetPasswordOtpEmail(forgetPasswordDto.contact, forgetPasswordOtp);
      }else{
        await this.smsService.sendForgetPasswordOtpSms(forgetPasswordOtp);
      }

      await user.save();

      return new ApiResponse<any>(
        true,
        "Otp has been sent to reset password !",
        HttpStatus.CREATED,
        null
      );

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }
  }

  async verifyForgetPasswordOtp(verifyResetPasswordDto: LoginByOtpDto): Promise<ApiResponse<any>> {

    try {

      const otpDetails = this.otpStore.get(verifyResetPasswordDto.contact);

      console.log(
        !otpDetails ||
        otpDetails.otp !== Number(verifyResetPasswordDto?.otp) ||
        otpDetails?.expiry < Date.now()
      ) 

      if (
        !otpDetails ||
        otpDetails.otp !== Number(verifyResetPasswordDto?.otp) ||
        otpDetails?.expiry < Date.now()
      ) {
        throw new HttpException("Invalid OTP!", HttpStatus.UNAUTHORIZED);
      }

      const isContactTypeEmail = this.getContactType(verifyResetPasswordDto.contact) === "email";

      const query = isContactTypeEmail ? { email: verifyResetPasswordDto.contact } : { contactNumber: verifyResetPasswordDto.contact };

      const user: any = await this.userModel.findOne({
        ...query,
        $or: [
          {
            emailOtpExpiry: {
              $gt: Date.now()
            },
            contactOtpExpiry: {
              $gt: Date.now()
            }
          },
          {
            isVerified: true
          }
        ]
      });

      if (!user) {
        throw new HttpException(`User doesn't exist with this ${isContactTypeEmail ? "email" : "contact number"}!`, HttpStatus.BAD_REQUEST)
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

      return new ApiResponse<any>(
        true,
        "Otp verified!",
        HttpStatus.OK,
        {
          token: resetPasswordToken
        }
      );

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<ApiResponse<any>> {

    try {

      const user: any = await this.userModel.findOne({
        resetPasswordToken: resetPasswordDto.token,
        isVerified: true
      });

      if (!user) {
        throw new HttpException("Unauthorized request!", HttpStatus.UNAUTHORIZED);
      }

      user.password = resetPasswordDto.password ;

      await user.save();

      return new ApiResponse<any>(
        true,
        "Password has been reset!",
        HttpStatus.OK
      );

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async getUserProfileInfo(request): Promise<ApiResponse<any>> {

    try {

      const { name, email, contactNumber, isVerified, profilePic, role } = request?.user;

      const user = {
        name,
        email,
        contactNumber,
        isVerified,
        profilePic,
        role
      }

      return new ApiResponse(
        true,
        "User profile fetched successfully",
        HttpStatus.OK,
        user
      )

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async uploadProfilePic(request, profilePicFile: Express.Multer.File) {

    try {

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

      return new ApiResponse(
        true,
        "Profile picture uploaded successfully",
        HttpStatus.OK,
        updatedUser
      )

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async refreshAccessToken(refreshTokenDto : RefreshTokenDto) {

    try {

      const payload : any = await this.tokenService.verifyRefeshToken(refreshTokenDto?.refreshToken);

      const user = await this.userModel.findOne({
        _id : payload?._id,
        refreshToken : refreshTokenDto.refreshToken
      });

      if(!user){
        throw new UnauthorizedException("Unauthorized request!");
      }

      const accessToken = await this.tokenService.generateAccessToken(user?._id);

      return new ApiResponse(
        true,
        "Access token refreshed successfully",
        HttpStatus.OK,
        {accessToken}
      )

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

  async logout(@Req() request){

    try {

      await this.userModel.findByIdAndUpdate(
        request?.user?._id,
        {
          $set : {
            refreshToken : ""
          }
        }
      );

      return new ApiResponse(
        true,
        "User logged out successfully",
        HttpStatus.OK
      )

    } catch (error) {

      return new ApiResponse<any>(
        false,
        error?.message || "Something went wrong !",
        error?.statusCode || error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        null
      );

    }

  }

}