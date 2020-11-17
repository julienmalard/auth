import { getRoot } from './getRoot'
import { getSuccessors, isSuccessor } from './successors'
import { buildChain, findByPayload, getPayloads } from './testUtils'

/*
                     ┌─→ e ─→ g ─┐
  a ─→ b ─┬─→ c ─→ d ┴─→ f ───── * ── * ─→ o ── * ─→ n
          ├─→ h ─→ i ─────────────────┘         │
          └─→ j ─→ k ─→ l ──────────────────────┘
 */
const chain = buildChain()

describe('chains', () => {
  describe('successors', () => {
    describe('getSuccessors', () => {
      test('root', () => {
        const a = getRoot(chain)
        const successors = getPayloads(getSuccessors(chain, a)).sort() // ignore order
        const expected = 'b c d e f g h i j k l n o'.split(' ')
        expect(successors).toEqual(expected)
      })

      test('d', () => {
        const d = findByPayload(chain, 'd')
        const successors = getPayloads(getSuccessors(chain, d))
        expect(successors).toEqual('f e g o n'.split(' ')) // note correct order
      })

      test('o', () => {
        const o = findByPayload(chain, 'o')
        const successors = getPayloads(getSuccessors(chain, o)).sort() // ignore order
        expect(successors).toEqual('n'.split(' '))
      })
    })

    describe('isSuccessor', () => {
      const testCase = (a: string, b: string) => {
        const aLink = findByPayload(chain, a)
        const bLink = findByPayload(chain, b)

        return isSuccessor(chain, aLink, bLink)
      }

      it('f succeeds c', () => expect(testCase('f', 'c')).toBe(true))
      it(`c doesn't succeed f`, () => expect(testCase('c', 'f')).toBe(false))
      it(`c doesn't succeed c`, () => expect(testCase('c', 'c')).toBe(false))
    })
  })
})
