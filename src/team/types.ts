import { LinkBody, SignatureChain, SignedLink } from '/chain'
import { LocalUserContext, MemberContext, DeviceWithPublicKeys } from '/context'
import { Invitation } from '/invitation/types'
import { KeyMetadata } from '/keyset'
import { Base64, Payload, ValidationResult } from '/util'
import { Lockbox } from '/lockbox'
import { Member } from '/member'
import { PermissionsMap, Role } from '/role'

// TEAM CONSTRUCTOR

export interface NewTeamOptions {
  teamName: string
  context: LocalUserContext
}

export interface ExistingTeamOptions {
  source: SignatureChain<TeamLink>
  context: LocalUserContext
}

export type TeamOptions = NewTeamOptions | ExistingTeamOptions

// type guard for NewTeamOptions vs ExistingTeamOptions
export function isNewTeam(options: TeamOptions): options is NewTeamOptions {
  return (options as ExistingTeamOptions).source === undefined
}

// TEAM STATE

export interface TeamState {
  teamName: string
  rootContext?: MemberContext
  members: Member[]
  roles: Role[]
  lockboxes: Lockbox[]
  invitations: InvitationMap
}

export interface TeamLockboxMap {
  [userName: string]: UserLockboxMap
}

export interface UserLockboxMap {
  [publicKey: string]: Lockbox[]
}

export interface InvitationMap {
  [id: string]: Invitation
}

// LINK TYPES

interface BasePayload {
  lockboxes?: Lockbox[]
}

export type TeamAction =
  | {
      type: 'ROOT'
      payload: BasePayload & {
        teamName: string
        rootMember: Member
      }
    }
  | {
      type: 'ADD_MEMBER'
      payload: BasePayload & {
        member: Member
        roles?: string[]
      }
    }
  | {
      type: 'ADD_DEVICE'
      payload: BasePayload & {
        userName: string
        deviceId: string
      }
    }
  | {
      type: 'ADD_ROLE'
      payload: BasePayload & Role
    }
  | {
      type: 'ADD_MEMBER_ROLE'
      payload: BasePayload & {
        userName: string
        roleName: string
        permissions?: PermissionsMap
      }
    }
  | {
      type: 'REMOVE_MEMBER'
      payload: BasePayload & {
        userName: string
      }
    }
  | {
      type: 'REMOVE_DEVICE'
      payload: BasePayload & {
        userName: string
        deviceId: string
      }
    }
  | {
      type: 'REMOVE_ROLE'
      payload: BasePayload & {
        roleName: string
      }
    }
  | {
      type: 'REMOVE_MEMBER_ROLE'
      payload: BasePayload & {
        userName: string
        roleName: string
      }
    }
  | {
      type: 'POST_INVITATION'
      payload: BasePayload & {
        invitation: Invitation
      }
    }
  | {
      type: 'REVOKE_INVITATION'
      payload: BasePayload & {
        id: string
      }
    }
  | {
      type: 'ADMIT_INVITED_MEMBER'
      payload: BasePayload & {
        id: string
        member: Member
        device: DeviceWithPublicKeys
        roles?: string[]
      }
    }

export type TeamLinkBody = LinkBody & TeamAction
export type TeamLink = SignedLink<TeamLinkBody>

// VALIDATION

export type TeamStateValidator = (
  prevState: TeamState,
  link: SignedLink<TeamLinkBody>
) => ValidationResult

export type TeamStateValidatorSet = {
  [key: string]: TeamStateValidator
}

export type ValidationArgs = [TeamState, SignedLink<TeamLinkBody>]

// CRYPTO

export interface EncryptedEnvelope {
  contents: Base64
  recipient: KeyMetadata
}

export interface SignedEnvelope {
  contents: Payload
  signature: Base64
  author: KeyMetadata
}
