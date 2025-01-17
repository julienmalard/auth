// register commands

import '@testing-library/cypress/add-commands'
import * as _commands from './commands'

// register assertions

import './assertions/be.admin'
import './assertions/be.online'
import './assertions/have.member'
import './assertions/be.onStartScreen'

import { type CommandFn } from './types'
export { type CommandFn } from './types'

const commands = _commands as Record<string, CommandFn>

for (const key in commands) {
  const command = commands[key]
  Cypress.Commands.add(key, { prevSubject: true }, command)
}

declare global {
  namespace Cypress {
    interface Chainable extends CustomCommands {}
  }
}

export type CustomCommands = typeof commands

declare global {
  namespace Cypress {
    interface Chainer<Subject> {
      (chainer: 'be.admin'): Chainable<Subject>
      (chainer: 'not.be.admin'): Chainable<Subject>
      (chainer: 'be.online'): Chainable<Subject>
      (chainer: 'not.be.online'): Chainable<Subject>
    }
  }
}

beforeEach(() => {
  cy.visit('/')
  localStorage.setItem('debug', 'lf:*')
})
