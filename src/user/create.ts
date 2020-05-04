﻿import { deriveKeys, KeysetWithSecrets, randomKey } from '../keys'
import { storeKeyset, loadKeyset } from '../secureStorage'
import { UserWithSecrets } from './types'

export const create = (name: string): UserWithSecrets => {
  const existingKeys = loadKeyset(name)
  if (existingKeys !== undefined)
    throw new Error(`There is already a keyset for user '${name}'`)
  const keys = generateNewKeyset()
  storeKeyset(name, keys)
  return { name, keys }
}

const generateNewKeyset = (): KeysetWithSecrets => deriveKeys(randomKey())
