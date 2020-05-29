import { create } from '/invitation/create'
import { accept } from '/invitation/accept'
import { validate } from '/invitation/validate'
import { generateKeys, randomKey } from '/keys'
import { newSecretKey } from './newSecretKey'
import { UserWithSecrets, redactUser } from '/user'

describe('invitations', () => {
  const teamKeys = generateKeys()

  test('create', () => {
    const secretKey = newSecretKey()
    const invitation = create({ teamKeys, userName: 'bob', secretKey })
    expect(secretKey).toHaveLength(16)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('encryptedPayload')
  })

  test('validate', () => {
    // Alice creates invitation. She sends the secret key to Bob, and records the invitation on the
    // team's signature chain.
    const secretKey = newSecretKey()

    const invitation = create({ teamKeys, userName: 'bob', secretKey })

    // Bob accepts invitation and obtains a credential proving that he was invited.
    const bob: UserWithSecrets = { userName: 'bob', keys: generateKeys() }
    const proofOfInvitation = accept(secretKey, redactUser(bob))

    // Bob shows up to join the team & sees Charlie. Bob shows Charlie his proof of invitation, and
    // Charlie checks it against the invitation that Alice posted on the signature chain.
    const validation = () => {
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      if (!validationResult.isValid) throw validationResult.error
    }

    expect(validation).not.toThrow()
  })
})