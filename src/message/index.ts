﻿import { KeyScope } from '/keyset'
import { Base64 } from '/lib'

export type Message =
  | ClaimIdentityMessage
  | ChallengeIdentityMessage
  | ProveIdentityMessage
  | typeof ACCEPT_IDENTITY
  | typeof REJECT_IDENTITY

export type ClaimIdentityMessage = {
  type: 'CLAIM_IDENTITY'
  payload: KeyScope
}

export type ChallengeIdentityMessage = {
  type: 'CHALLENGE_IDENTITY'
  payload: ChallengePayload
}

export type ProveIdentityMessage = {
  type: 'PROVE_IDENTITY'
  payload: ChallengePayload & {
    signature: Base64
  }
}

type ChallengePayload = KeyScope & {
  nonce: Base64
  timestamp: UnixTimestamp
}

export const ACCEPT_IDENTITY = { type: 'ACCEPT_IDENTITY' }
export const REJECT_IDENTITY = { type: 'REJECT_IDENTITY' }

export type UnixTimestamp = number
