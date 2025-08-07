import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from "socket.io";
import { TokenService } from 'src/token/token.service';
import { ChatService } from './chat.service';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { Types } from 'mongoose';
import { UseFilters } from '@nestjs/common';
import { WsExceptionFilter } from 'src/common/filters/ws-error.filter';

@WebSocketGateway()
@UseFilters(new WsExceptionFilter())
export class ChatGateway {

  constructor(
    private tokenService: TokenService,
    private chatService : ChatService
  ) { }

  @WebSocketServer()
  server: Server;

  private userSockets = new Map();

  private async sendPendingMessages(client,_id){
    
    const pendingMessages = await this.chatService.getUsersPendingMessages(_id);

      console.log(this.userSockets);

      if(pendingMessages?.length > 0){
        
        for(let pendingMessage of pendingMessages){

          if(pendingMessage.chat.isGroup){
            var messageEvent = 'send-group-message' ;
          }else{
            var messageEvent = 'send-direct-message' ;
          }

          this.server.to(client.id).emit(messageEvent,{...pendingMessage,deliveredTo : null});
          
          const senderSocketId = this.userSockets.get(pendingMessage.sender._id.toString());
          await this.chatService.markMessageDelivered(pendingMessage._id,_id);

          console.log(senderSocketId)
          
          if(senderSocketId){

            this.server.to(senderSocketId).emit('message-delivered',{messageId : pendingMessage?._id, recieverId : client.userId});

          }

        }

      }

  }

  private async addUserToGroupRoom(client,_id){

    const usersGroups : any = await this.chatService.getUserGroups(_id) ;

    for(const userGroup of usersGroups) {
      client.join(userGroup._id.toString());
      console.log(`User : ${_id} has joined the group ${userGroup?._id} with socketId : ${client.id} !`)
    }

  }

  async handleConnection(client: Socket) {

    try {

      const token = client.handshake.query.token;

      const { _id } = await this.tokenService.verifyAccessToken(String(token));

      this.userSockets.set(_id,client.id);

      console.log(this.userSockets);

      (client as any).userId = _id ;
      
      await this.addUserToGroupRoom(client,_id);

      await this.sendPendingMessages(client,_id);

    } catch (error) {

      client.disconnect();

      console.log(error)

    }

  }

  handleDisconnect(client: any) {

    this.userSockets.delete(client?.userId);

  }

  @SubscribeMessage('send-direct-message')
  async handleMessage(client: any, payload: SendDirectMessageDto) {

    const newMessage = await this.chatService.createNewDirectMessage(client.userId,payload.receiverId,payload.content,payload.contentType,this.userSockets);

    const senderSocketId = this.userSockets.get(client.userId);
    const recieverSocketId = this.userSockets.get(payload.receiverId);

    this.server.to([senderSocketId,recieverSocketId]).emit('send-direct-message',{...newMessage,deliveredTo : null});

    if(newMessage.deliveredTo.includes(new Types.ObjectId(payload.receiverId))){
      this.server.to(senderSocketId).emit('message-delivered',{messageId : newMessage?._id, recieverId : client.userId});
    }

  }

  @SubscribeMessage('message-seen')
  async handleMessageSeen(client: any, payload: {messageId : string}) {

    const seenMessage = await this.chatService.markMessageSeen(payload.messageId,client.userId);

    const senderSocketId = this.userSockets.get(seenMessage?.senderId.toString());

    if(senderSocketId){
      this.server.to(senderSocketId).emit('message-seen',{messageId : seenMessage?._id, recieverId : client.userId});
    }

  }

  @SubscribeMessage('send-group-message')
  async handleGroupMessage(client : any, payload : any){

    const newMessage = await this.chatService.createGroupMessage(client?.userId,payload?.groupId,payload?.content,payload.contentType,this.userSockets);

    this.server.to(payload.groupId.toString()).emit('send-group-message',newMessage);

  }

  @SubscribeMessage('remove-user')
  async handleRemoveUser(client : any, payload : any){

    const res = await this.chatService.removeAParticipant(client?.userId,payload?.groupId,payload?.userId);

    const removedParticipantSocketId = this.userSockets.get(payload.userId);

    if(removedParticipantSocketId){
      const removedParticipantSocket = this.server.sockets.sockets.get(removedParticipantSocketId);
      removedParticipantSocket?.leave(payload.groupId)
      this.server.to(removedParticipantSocketId).emit('user-removed',`You have been removed from ${res.group} group by ${res?.admin || "admin"}`);
    }

  }

  @SubscribeMessage('make-admin')
  async handleMakeAdmin(client : any, payload : any){

    const groupName = await this.chatService.makeAnAdmin(client?.userId,payload?.groupId,payload?.userId);

    const newAdminSocketId = this.userSockets.get(payload.userId);

    if(newAdminSocketId){
      this.server.to(newAdminSocketId).emit('made-admin',`You are now an admin of ${groupName}`);
    }

  }

  @SubscribeMessage('remove-admin')
  async handleRemoveAdmin(client : any, payload : any){

    const groupName = await this.chatService.removeAnAdmin(client?.userId,payload?.groupId,payload?.userId);

    const removedAdminSocketId = this.userSockets.get(payload.userId);

    if(removedAdminSocketId){
      this.server.to(removedAdminSocketId).emit('admin-removed',`You are no longer an admin of ${groupName}`);
    }

  }

  @SubscribeMessage('add-participants')
  async handleAddParticipant(client : any, payload : any){

    const res = await this.chatService.addParticipantsToGroup(client?.userId,payload?.groupId,payload?.participants);

    for(const participant of payload.participants){

      const addedParticipantSocketId = this.userSockets.get(participant);
  
      if(addedParticipantSocketId){
        const addedParticipantSocket = this.server.sockets.sockets.get(addedParticipantSocketId);
        addedParticipantSocket?.join(payload.groupId)
        this.server.to(addedParticipantSocketId).emit('user-added',`You are added in ${res.group} group by ${res.admin}`);
      }

    }


  }

}