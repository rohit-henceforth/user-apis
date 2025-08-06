import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from "socket.io";
import { TokenService } from 'src/token/token.service';
import { ChatService } from './chat.service';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { Types } from 'mongoose';

@WebSocketGateway()
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

    console.log(usersGroups);

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

    const newMessage = await this.chatService.createNewDirectMessage(client.userId,payload.receiverId,payload.content,this.userSockets);

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

    const newMessage = await this.chatService.createGroupMessage(client?.userId,payload?.groupId,payload?.content,this.userSockets);

    client.to(payload.groupId.toString()).emit('send-group-message',newMessage);

  }

}