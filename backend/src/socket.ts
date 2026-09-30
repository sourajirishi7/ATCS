import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer, clientUrl: string): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: clientUrl || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Client can join department or role-based rooms
    socket.on('join_department', (deptId: string) => {
      if (deptId) {
        socket.join(`dept_${deptId}`);
      }
    });

    socket.on('join_role', (role: string) => {
      if (role) {
        socket.join(`role_${role}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitEvent(event: string, payload: any, departmentId?: string) {
  if (!io) return;
  if (departmentId) {
    // Emit to specific department room and global admin/finance
    io.to(`dept_${departmentId}`).to('role_ADMIN').to('role_FINANCE').emit(event, payload);
  } else {
    // Global broadcast
    io.emit(event, payload);
  }
}
