import { Host, Server, ServerWithSecrets } from '@/server'
import { cast } from '@/server/cast'
import { KeyType } from '@/util'
import {
  all,
  joinTestChannel,
  setup as setupHumans,
  SetupConfig,
  TestChannel,
  updated,
  UserStuff,
} from '@/util/testing'
import { createKeyset, redactKeys } from '@localfirst/crdx'
import EventEmitter from 'eventemitter3'
import {
  Connection,
  createTeam,
  InitialContext,
  invitation,
  loadTeam,
  MemberInitialContext,
  Team,
} from '..'

describe('Team', () => {
  describe('a server', () => {
    it('can be added and removed by an admin', () => {
      const { alice } = setupHumans('alice')

      // add server
      const { server } = createServer(host)
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)

      // look up server
      const serverFromTeam = alice.team.servers(host)
      expect(serverFromTeam.host).toBe(host)

      // remove server
      alice.team.removeServer(host)
      expect(alice.team.servers().length).toBe(0)
      expect(alice.team.serverWasRemoved(host)).toBe(true)
    })

    it(`can't be added by a non-admin member`, () => {
      const { bob } = setupHumans('alice', { user: 'bob', admin: false })

      const { server } = createServer(host)
      const tryToAddServer = () => bob.team.addServer(server)

      expect(tryToAddServer).toThrowError()
      expect(bob.team.servers().length).toBe(0)
    })

    it(`can't be removed by a non-admin member`, () => {
      const { alice, bob } = setupHumans('alice', { user: 'bob', admin: false })

      // add server
      const { server } = createServer(host)
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)

      const tryToRemoveServer = () => bob.team.removeServer(host)
      expect(tryToRemoveServer).toThrowError()
    })

    it(`can decrypt a team graph`, () => {
      const { alice } = setupHumans('alice', 'bob', { user: 'charlie', admin: false })
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)

      // add some stuff to the team graph
      alice.team.addRole('MANAGER')
      const { id: memberInviteId } = alice.team.inviteMember()
      const { id: deviceInviteId } = alice.team.inviteDevice()

      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()

      // the server instantiates the team
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      // all the stuff that should be on the graph is there
      expect(serverTeam.members().length).toBe(3)
      expect(serverTeam.roles('MANAGER')).toBeDefined()
      expect(serverTeam.getInvitation(memberInviteId)).toBeDefined()
      expect(serverTeam.getInvitation(deviceInviteId)).toBeDefined()
    })

    it(`syncs with a user - changes made before connecting`, async () => {
      const { server, alice } = setup('alice')

      // alice makes a change
      alice.team.addRole('MANAGER')

      // alice connects to the server
      await connectWithServer(alice, server)

      // the server gets the change
      expect(server.team.roles('MANAGER')).toBeDefined()
    })

    it(`syncs with a user - changes made after connecting`, async () => {
      const { server, alice } = setup('alice')

      // alice connects to the server
      await connectWithServer(alice, server)

      // alice makes a change
      alice.team.addRole('MANAGER')

      // the server gets the change
      await eventPromise(server.team, 'updated')
      expect(server.team.roles('MANAGER')).toBeDefined()
    })

    it(`can't create a team`, () => {
      const { serverWithSecrets } = createServer(host)
      expect(() => {
        createTeam('team server', {
          server: serverWithSecrets,
        })
      }).toThrow()
    })

    it(`can't invite a member`, () => {
      const { server } = setup('alice')

      expect(() => server.team.inviteMember()).toThrow()
    })

    it(`can admit an invitee`, async () => {
      const { server, alice, bob } = setup('alice', { user: 'bob', member: false })
      const { seed: bobInvite } = alice.team.inviteMember()

      // the server learns about the invitation by connecting with alice
      await connectWithServer(alice, server)

      // now if bob connects to the server, the server can admit him
      server.team.admitMember(invitation.generateProof(bobInvite), bob.user.keys, bob.userId)
      expect(server.team.members().length).toBe(2)
    })

    it(`can't invite a device`, () => {
      const { server } = setup('alice')
      expect(() => server.team.inviteDevice()).toThrow()
    })

    it(`can't remove a member`, () => {
      const { server, bob } = setup('alice', 'bob')
      expect(() => server.team.remove(bob.userId)).toThrow()
    })

    it(`can relay changes from one member to another asynchronously`, async () => {
      const { server, alice, bob } = setup('alice', 'bob')

      // alice makes a change
      alice.team.addRole('MANAGER')

      // alice connects to the server
      await connectWithServer(alice, server)

      // server learned of the change
      expect(server.team.roles('MANAGER')).toBeDefined()

      // alice disconnects from the server
      alice.connection[host].stop()
      server.connection[alice.userId].stop()

      // bob connects to the server
      await connectWithServer(bob, server)

      // server told bob about new role
      expect(bob.team.roles('MANAGER')).toBeDefined()
    })

    it(`can change its own keys`, async () => {
      const { alice } = setupHumans('alice', 'bob')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const savedGraph = alice.team.save()
      const aliceTeamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, aliceTeamKeys)

      const teamKeys0 = serverTeam.teamKeys()
      expect(teamKeys0.generation).toBe(0)

      // Server changes their keys
      serverTeam.changeKeys(createKeyset({ type: KeyType.SERVER, name: host }))

      // server keys have been rotated
      expect(serverTeam.servers(host).keys.generation).toBe(1)

      // Server still has access to team keys
      const teamKeys1 = serverTeam.teamKeys()

      // the team keys were rotated, so these are new
      expect(teamKeys1.encryption.publicKey).not.toEqual(teamKeys0.encryption.publicKey)
      expect(teamKeys1.generation).toBe(1)
    })
  })
})

const connectionPromise = async (a: Connection, b: Connection) => {
  const connections = [a, b]

  // ✅ They're both connected
  await all(connections, 'connected')

  const sharedKey = connections[0].sessionKey
  connections.forEach(connection => {
    expect(connection.state).toEqual('connected')
    // ✅ They've converged on a shared secret key
    expect(connection.sessionKey).toEqual(sharedKey)
  })
}

const connectWithServer = async (user: UserStuff, server: ServerStuff) => {
  const join = joinTestChannel(new TestChannel())

  user.connection[host] = join(user.connectionContext).start()
  server.connection[user.userId] = join(server.connectionContext).start()

  return connectionPromise(user.connection[host], server.connection[user.userId])
}

const createServer = (host: Host) => {
  const serverKeys = createKeyset({ type: KeyType.SERVER, name: host })
  const serverWithSecrets: ServerWithSecrets = { host, keys: serverKeys }
  const server: Server = { host, keys: redactKeys(serverKeys) }
  return { server, serverWithSecrets }
}

const host = 'example.com'

const setup = (...humanUsers: SetupConfig) => {
  const serverKeys = createKeyset({ type: KeyType.SERVER, name: host })
  const serverWithSecrets: ServerWithSecrets = { host, keys: serverKeys }
  const server: Server = { host, keys: redactKeys(serverKeys) }

  const users = setupHumans(...humanUsers)

  const founder = users[humanUsers[0].toString()]
  const teamKeys = founder.team.teamKeys()

  // add the server to one team
  founder.team.addServer(server)
  const savedGraph = founder.team.save()

  // set everybody's team to the one containing the server
  for (const userStuff of Object.values(users)) {
    const { userId, user, device, team } = userStuff
    if (userId === founder.userId) continue
    if (team) {
      const newTeam = loadTeam(savedGraph, { user, device }, teamKeys)
      userStuff.team = newTeam
      const connectionContext = userStuff.connectionContext as MemberInitialContext
      connectionContext.team = newTeam
    }
  }

  const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

  const serverStuff = {
    server,
    serverWithSecrets,
    team: serverTeam,
    connectionContext: {
      userName: host,
      user: cast.toUser(serverWithSecrets),
      device: cast.toDevice(serverWithSecrets),
      team: serverTeam,
    },
    connection: {},
  } as ServerStuff
  return {
    ...users,
    server: serverStuff,
  } as Record<string, UserStuff> & { server: ServerStuff }
}

type ServerStuff = {
  server: Server
  serverWithSecrets: ServerWithSecrets
  team: Team
  connectionContext: InitialContext
  connection: Record<string, Connection>
}

export const eventPromise = (emitter: EventEmitter, event: string) =>
  new Promise<any>(resolve => emitter.once(event, d => resolve(d)))
