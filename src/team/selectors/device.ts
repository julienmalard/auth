import { member } from './member'
import { TeamState } from '/team/types'

export const device = (state: TeamState, userName: string, deviceName: string) => {
  const memberDevices = member(state, userName).devices || []
  const device = memberDevices.find(d => d.deviceName === deviceName)
  if (device === undefined)
    throw new Error(`Member ${userName} does not have a device called ${deviceName}`)
  return device
}
