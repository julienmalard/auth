import * as devices from '/device'
import { getDeviceId } from '/device'
import { generateProof, ProofOfInvitation } from '/invitation'
import { ADMIN } from '/role'
import * as teams from '/team'
import { setup } from '/util/testing'
import { KeyType } from '/keyset'
import { generateStarterKeys } from '/invitation/generateStarterKeys'

const { MEMBER, DEVICE } = KeyType
describe('Team', () => {
  describe('invitations', () => {
    describe('members', () => {
      it('accepts valid proof of invitation', () => {
        const { alice } = setup(['alice'])

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.invite({ userName: 'bob' })

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, 'bob')

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in
        alice.team.admit(proofOfInvitation)

        // ✅ 👨🏻‍🦲 Bob is now on the team. Congratulations, Bob!
        expect(alice.team.has('bob')).toBe(true)
      })

      it('lets you use a key of your choosing', () => {
        const { alice } = setup(['alice'])

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a secret key of her choosing
        const seed = 'passw0rd'
        alice.team.invite({ userName: 'bob', seed })

        const proofOfInvitation = generateProof(seed, 'bob')
        alice.team.admit(proofOfInvitation)

        // ✅ Still works
        expect(alice.team.has('bob')).toBe(true)
      })

      it('normalizes the secret key', () => {
        const { alice } = setup(['alice'])

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const seed = 'abc def ghi'
        alice.team.invite({ userName: 'bob', seed })

        // 👨🏻‍🦲 Bob accepts the invitation using a url-friendlier version of the key
        const proofOfInvitation = generateProof('abc+def+ghi', 'bob')
        alice.team.admit(proofOfInvitation)

        // ✅ Bob is on the team
        expect(alice.team.has('bob')).toBe(true)
      })

      it('supports including roles in the invitation', () => {
        const { alice } = setup(['alice'])

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob as admin
        const { seed } = alice.team.invite({ userName: 'bob', roles: [ADMIN] })

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, 'bob')
        alice.team.admit(proofOfInvitation)

        // ✅ Bob is on the team as an admin 👍
        expect(alice.team.memberIsAdmin('bob')).toBe(true)
      })

      it('rejects invitation if name is altered', () => {
        const { alice } = setup(['alice'])

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const { seed } = alice.team.invite({ userName: 'bob' })

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, 'bob')

        // 🦹‍♀️ Eve intercepts the invitation and tries to use it by swapping out Bob's name for hers
        const forgedProofOfInvitation: ProofOfInvitation = {
          ...proofOfInvitation,
          invitee: { type: MEMBER, name: 'eve' },
        }

        // 🦹‍♀️ Eve shows 👩🏾 Alice her fake proof of invitation
        const presentForgedInvitation = () => alice.team.admit(forgedProofOfInvitation)

        // ✅ but 👩🏾 Alice is not fooled 👎
        expect(presentForgedInvitation).toThrow(/User names don't match/)
      })

      it('allows non-admins to accept an invitation', () => {
        let { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed } = alice.team.invite({ userName: 'charlie' })

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed, 'charlie')

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        let persistedTeam = alice.team.save()
        const bobsTeam = teams.load(persistedTeam, bob.localContext)

        // just to confirm: 👨🏻‍🦲 Bob isn't an admin
        expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        bobsTeam.admit(proofOfInvitation)

        // 👍👳🏽‍♂️ Charlie is now on the team
        expect(bobsTeam.has('charlie')).toBe(true)

        // ✅ 👩🏾 Alice can now see that 👳🏽‍♂️ Charlie is on the team. Congratulations, Charlie!
        persistedTeam = bobsTeam.save()
        alice.team = teams.load(persistedTeam, alice.localContext)
        expect(alice.team.has('charlie')).toBe(true)
      })

      it('allows revoking an invitation', () => {
        let { alice, bob } = setup(['alice', 'bob'])

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed, id } = alice.team.invite({ userName: 'charlie' })

        expect(alice.team.has('charlie')).toBe(true)

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed, 'charlie')

        // 👩🏾 Alice changes her mind and revokes the invitation
        alice.team.revokeInvitation(id)

        expect(alice.team.has('charlie')).toBe(false)

        // later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        const persistedTeam = alice.team.save()
        bob.team = teams.load(persistedTeam, bob.localContext)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        const tryToAdmitCharlie = () => bob.team.admit(proofOfInvitation)

        // 👎 But the invitation is rejected
        expect(tryToAdmitCharlie).toThrowError(/revoked/)

        // ✅ 👳🏽‍♂️ Charlie is not on the team
        expect(bob.team.has('charlie')).toBe(false)
      })
    })

    describe('devices', () => {
      it('creates and accepts an invitation for a device', () => {
        const { alice } = setup(['alice'])

        const deviceName = 'alicez phone'

        // 👩🏾 Alice only has 💻 one device on the signature chain
        expect(alice.team.members('alice').devices).toHaveLength(1)

        // 💻 on her laptop, Alice generates an invitation for her phone
        const { seed } = alice.team.invite({ deviceName })

        // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.
        // Alice's phone uses the seed to generate her starter keys and her proof of invitation
        const phone = devices.create('alice', deviceName)
        const deviceId = getDeviceId(phone)
        phone.keys = generateStarterKeys({ type: DEVICE, name: deviceId }, seed)
        const proofOfInvitation = generateProof(seed, { type: DEVICE, name: deviceId })

        // 📱 Alice's phone connects with 💻 her laptop and presents the proof
        alice.team.admit(proofOfInvitation)

        // 👍 The proof was good, so the laptop sends the phone the team's signature chain
        const savedTeam = alice.team.save()
        const phoneTeam = teams.load(savedTeam, { device: phone })

        // 📱 Alice's phone joins the team
        const { user, device } = phoneTeam.join(proofOfInvitation)

        // ✅ Now Alice has 💻📱 two devices on the signature chain
        expect(phoneTeam.members('alice').devices).toHaveLength(2)
      })
    })
  })
})
