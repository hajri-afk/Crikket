import {
  assignBugReportsToRoom,
  createRoomProcedure,
  deleteRoomProcedure,
  getRoom,
  listRooms,
  updateRoomProcedure,
} from "@crikket/bug-reports/procedures/rooms"

/**
 * Room Router
 * Rooms group bug reports per project inside an organization.
 * All logic lives in @crikket/bug-reports package modules
 */
export const roomRouter = {
  list: listRooms,
  get: getRoom,
  create: createRoomProcedure,
  update: updateRoomProcedure,
  delete: deleteRoomProcedure,
  assignReports: assignBugReportsToRoom,
}
