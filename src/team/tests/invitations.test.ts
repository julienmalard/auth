import { DeviceType, DeviceWithSecrets, getDeviceId, redactDevice } from '/device'
import { acceptDeviceInvitation, acceptMemberInvitation, ProofOfInvitation } from '/invitation'
import * as keyset from '/keyset'
import { KeyType } from '/keyset'
import { redactUser } from '/user'
import {
  alicesContext,
  bob,
  bobsContext,
  charlie,
  defaultContext,
  eve,
  newTeam,
  storage,
} from '/util/testing'

const { DEVICE } = KeyType

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  describe('invitations', () => {
    it('creates an invitation', () => {
      const { team } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey } = team.invite('bob')
      expect(secretKey).toHaveLength(16)
    })

    it('accepts valid proof of invitation', () => {
      const { team: alicesTeam } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob by sending him a secret key
      const { secretKey } = alicesTeam.invite('bob')

      // 👨‍🦲 Bob accepts the invitation
      const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(bob))

      // 👨‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in
      alicesTeam.admit(proofOfInvitation)

      // ✅ 👨‍🦲 Bob is now on the team. Congratulations, Bob!
      expect(alicesTeam.has('bob')).toBe(true)
    })

    it('rejects invitation if name is altered', () => {
      const { team: alicesTeam } = setup()

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey } = alicesTeam.invite('bob')

      // 👨‍🦲 Bob accepts the invitation
      const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(bob))

      // 🦹‍♀️ Eve intercepts the invitation and tries to use it by swapping out Bob's info for hers
      const forgedProofOfInvitation: ProofOfInvitation = {
        ...proofOfInvitation,
        type: 'MEMBER',
        payload: redactUser(eve),
      }

      // 🦹‍♀️ Eve shows 👩🏾 Alice her fake proof of invitation
      const presentForgedInvitation = () => alicesTeam.admit(forgedProofOfInvitation)

      // ❌ but 👩🏾 Alice is not fooled
      expect(presentForgedInvitation).toThrow(/User names don't match/)
    })

    it('allows non-admins to accept an invitation', () => {
      let { team: alicesTeam } = setup()
      alicesTeam.add(bob) // bob is not an admin

      // 👩🏾 Alice invites 👳‍♂️ Charlie by sending him a secret key
      const { secretKey } = alicesTeam.invite('charlie')
      storage.save(alicesTeam)

      // 👳‍♂️ Charlie accepts the invitation
      const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(charlie))

      // Alice is no longer around, but 👨‍🦲 Bob is online
      const bobsTeam = storage.load(bobsContext)

      // just to confirm: 👨‍🦲 Bob still isn't an admin
      expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

      // 👳‍♂️ Charlie shows 👨‍🦲 Bob his proof of invitation
      bobsTeam.admit(proofOfInvitation)

      // 👳‍♂️ Charlie is now on the team
      expect(bobsTeam.has('charlie')).toBe(true)

      // ✅ 👩🏾 Alice can now see that 👳‍♂️ Charlie is on the team. Congratulations, Charlie!
      storage.save(bobsTeam)
      alicesTeam = storage.load(alicesContext)
      expect(alicesTeam.has('charlie')).toBe(true)
    })

    it('allows revoking an invitation', () => {
      let { team: alicesTeam } = setup()
      alicesTeam.add(bob) // bob is not an admin

      // 👩🏾 Alice invites 👳‍♂️ Charlie by sending him a secret key
      const { secretKey, id } = alicesTeam.invite('charlie')

      // 👳‍♂️ Charlie accepts the invitation
      const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(charlie))

      // 👩🏾 Alice changes her mind and revokes the invitation
      alicesTeam.revokeInvitation(id)

      storage.save(alicesTeam)

      // Alice is no longer around, but 👨‍🦲 Bob is online
      const bobsTeam = storage.load(bobsContext)

      // 👳‍♂️ Charlie shows 👨‍🦲 Bob his proof of invitation
      const tryToAdmitCharlie = () => bobsTeam.admit(proofOfInvitation)

      // But the invitation is rejected
      expect(tryToAdmitCharlie).toThrowError(/No invitation/)

      // 👳‍♂️ Charlie is not on the team
      expect(bobsTeam.has('charlie')).toBe(false)
    })

    it('creates and accepts an invitation for a device', () => {
      const { team, context } = setup()
      team.add(bob) // added for code coverage purposes

      // 💻 Alice is on her laptop
      expect(context.user.device.name).toBe(`alice's device`)

      // 💻 Alice generates an invitation, which is stored on the team's signature chain
      const device = { userName: 'alice', name: `alice's phone`, type: DeviceType.mobile }
      const { secretKey } = team.inviteDevice(device)

      // 📱 Alice gets the secret invitation key to her phone, perhaps by typing it in or by scanning a
      // QR code. Alice's phone uses the secret key to generate proof of invitation
      const deviceId = getDeviceId(device)
      const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
      const deviceWithSecrets: DeviceWithSecrets = { ...device, keys: deviceKeys }
      const proofOfInvitation = acceptDeviceInvitation(secretKey, redactDevice(deviceWithSecrets))

      // 📱 Alice's phone connects with 💻 her laptop and presents the proof
      team.admitDevice(proofOfInvitation)

      // 📱 Alice's phone is now listed on the signature chain
      expect(team.members('alice').devices!.map(d => d.deviceId)).toContain(deviceId)
    })

    it('rejects device invitation if altered', () => {
      const { team, context } = setup()
      team.add(bob) // added for code coverage purposes

      // 💻 Alice is on her laptop
      expect(context.user.device.name).toBe(`alice's device`)

      // 💻 Alice generates an invitation, which is stored on the team's signature chain
      const device = { userName: 'alice', name: `alice's phone`, type: DeviceType.mobile }
      const { secretKey } = team.inviteDevice(device)

      // 📱 Alice gets the secret invitation key to her phone, perhaps by typing it in or by scanning a
      // QR code. Alice's phone uses the secret key to generate proof of invitation
      const deviceId = getDeviceId(device)
      const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
      const deviceWithSecrets: DeviceWithSecrets = { ...device, keys: deviceKeys }
      const proofOfInvitation = acceptDeviceInvitation(secretKey, redactDevice(deviceWithSecrets))

      // 🦹‍♀️ Oh no!! Eve intercepts the invitation and tries to use it by swapping out Bob's info for hers
      const evesDevice = { userName: 'alice', name: `alice's phone`, type: DeviceType.mobile }
      const evesDeviceId = getDeviceId(evesDevice)
      const evesDeviceKeys = keyset.create({ type: DEVICE, name: evesDeviceId })
      const evesDeviceWithSecrets: DeviceWithSecrets = { ...device, keys: evesDeviceKeys }

      const forgedProofOfInvitation: ProofOfInvitation = {
        ...proofOfInvitation,
        type: 'DEVICE',
        payload: redactDevice(evesDeviceWithSecrets),
      }

      // 🦹‍♀️📱 Eve tries to gain admission with her fraudulent credentials
      const tryToAdmitEve = () => team.admitDevice(forgedProofOfInvitation)
      expect(tryToAdmitEve).toThrow(/Signature provided is not valid/)

      // Eve's device was not added
      const aliceDevices = team.members('alice').devices || []
      expect(aliceDevices.map(d => d.deviceId)).not.toContain(evesDeviceId)
    })
  })
})
