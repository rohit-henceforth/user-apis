import { UnauthorizedException } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from "socket.io";
import { TokenService } from 'src/token/token.service';

@WebSocketGateway()
export class ChatGateway {

  constructor(
    private tokenService: TokenService
  ) { }

  @WebSocketServer()
  server: Server;

  private userSockets = new Map();

  async handleConnection(client: Socket) {

    try {

      // const userToken = client.handshake.query.token as string;

      // if (!userToken) {
      //   throw new UnauthorizedException("User token is required")
      // }

      // const user = await this.tokenService.verifyAccessToken(userToken);

      // this.userSockets.set(user?._id, client?.id);

      // (client as any).user = user?._id;

      console.log(`New user connected to socket.io using id : ${client.id}`)

    } catch (error) {

      client.disconnect();

      throw error ;

    }

  }

  handleDisconnect(client: any) {

    this.userSockets.delete(client?.user);

    console.log(`A user disconnected to socket.io using id: ${client.id}`)

  }

  @SubscribeMessage('new-message')
  handleMessage(client: any, payload: any) {

    this.server.emit('new-message', payload)

  }

  @SubscribeMessage('join-group')
  handleJoinGroup(client: any, payload: any) {

    client.join("new-group")

  }

  @SubscribeMessage('message-group')
  handleMessageGroup(client: any, payload: any) {
    this.server.to("new-group").emit('new-message',payload)
  } 

}