﻿import { hash } from '@herbcaudill/crypto'
import { getHead } from './getHead'
import { getCommonPredecessor, isPredecessor } from './predecessors'
import { getRoot } from '/chain/getRoot'
import {
  Link,
  isMergeLink,
  isRootLink,
  Action,
  NonRootLinkBody,
  Resolver,
  RootLink,
  SignatureChain,
  SignedLink,
  ActionLink,
} from '/chain/types'

/**
 * Takes a `SignatureChain` and returns an array of links by performing a topographical sort and
 * filter. For example, this chain
 *```
 *           ┌─→ c ─→ d ─┐
 * a ─→ b ─→ ┴─→ e ───── * ─→ f
 *```
 *
 * might be transformed to this sequence
 *```
 * [a, b, e, c, d, f]
 *```
 * The logic for merging these branches is encapsulated in a `Resolver` function provided in the
 * options. In the example above, the two concurrent branches `[c,d]` and `[e]` are merged into `[e,
 * c, d]`. A different resolver might return the links in a different order, and/or omit some
 * links. These two branches might also be resolved as:
 *```
 * [c, d, e]
 * [c, e, d]
 * [c, d]
 * [e, d]
 * [e]
 * ... etc.
 *```
 *
 * If no resolver is provided, a trivial one will be used, which simply concatenates the concurrent
 * branches in an arbitrary but deterministic order.
 *
 * @param chain The SignatureChain containing the links to be sequenced
 * @param options.resolver A function that takes two sequences and returns a single sequence
 * combining the two while applying any necessary business logic regarding which links take
 * precedence, which are omitted, etc.
 * @param options.root The link to use as the chain's root (used to process a subchain)
 * @param options.head The link to use as the chain's head (used to process a subchain)
 */
export const getSequence = <A extends Action>(
  chain: SignatureChain<A>,
  {
    resolver = trivialResolver,
    root = getRoot(chain),
    head = getHead(chain),
  }: GetSequenceOptions<A> = {}
): ActionLink<A>[] => {
  // recursive inner function - returns the given link's predecessors and the given link
  const visit = (link: Link<A>): Link<A>[] => {
    if (isRootLink(link) || link === root) {
      // root - we're done
      return []
    } else if (!isMergeLink(link)) {
      // normal signed link - keep going
      const signedLink = link as SignedLink<NonRootLinkBody<A>, A>
      const parent = chain.links[signedLink.body.prev]
      return visit(parent).concat(parent)
    } else {
      // merge link - need to resolve the two branches it merges, going back to the first common predecessor

      // these are two branch heads (the links merged by the merge link)
      const branchHeads = link.body.map(hash => chain.links[hash]!)

      // we need to work our way back to their latest common predecessor
      const commonPredecessor = getCommonPredecessor(chain, branchHeads)

      // however, if the common predecessor precedes the root we've been given,
      // that means the root lives on one of these two branches
      if (isPredecessor(chain, commonPredecessor, root)) {
        // we're only interested in the branch that the root is on; we can ignore the other one
        const ourBranchHead = branchHeads.find(h => root === h || isPredecessor(chain, root, h))!
        return getSequence(chain, {
          root,
          head: ourBranchHead,
          resolver,
        })
      } else {
        const getBranchSequence = (branchHead: Link<A>): ActionLink<A>[] => {
          // each branch is the sequence from the common predecessor to the branch head
          const branch = getSequence(chain, {
            root: commonPredecessor,
            head: branchHead,
            resolver,
          })

          // omit the common predecessor itself from the two branches, so it's not duplicated
          // (we'll add it back to the merged sequence below)
          return branch.filter(n => n !== commonPredecessor)
        }

        // the common predecessor is after the root, so we have two branches that we'll need to merge
        const [branchA, branchB] = branchHeads.map(getBranchSequence)

        const resolvedBranches = resolver(branchA, branchB)

        // now we can resume working our way back from the common predecessor towards the root
        return visit(commonPredecessor)
          .concat(commonPredecessor) //
          .concat(resolvedBranches)
      }
    }
  }

  // we start from the head and work our way back towards the root
  return visit(head)
    .concat(head)
    .filter(n => !isMergeLink(n)) as ActionLink<A>[]
}

/// If no resolver is provided, we just concatenate the two sequences in an arbitrary but deterministic manner
const trivialResolver: Resolver = (a = [], b = []) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort) // ensure predictable order
  return _a.concat(_b)
}

export type GetSequenceOptions<A extends Action> = {
  resolver?: Resolver
  root?: Link<A>
  head?: Link<A>
}

const arbitraryDeterministicSort = (a: Link<any>[], b: Link<any>[]) => {
  const hashKey = 'DETERMINISTIC_SORT'
  return hash(hashKey, a[0].body.payload) > hash(hashKey, b[0].body.payload) ? 1 : -1
}
