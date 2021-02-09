import { Reducer } from '/team/reducers/index'
import { PublicKeyset } from '/keyset'
import { debug } from '/util'
import { parseDeviceId, PublicDevice } from '/device'

const log = debug('lf:auth:reducer')

export const changeDeviceKeys = (keys: PublicKeyset): Reducer => state => {
  const { userName, deviceName } = parseDeviceId(keys.name)
  return {
    ...state,
    members: state.members.map(member => {
      if (member.userName === userName) {
        return {
          ...member,
          devices: member.devices?.map(device => ({
            ...device,
            keys, // 🡐 replace device keys
          })),
        }
      } else return member
    }),
  }
}
