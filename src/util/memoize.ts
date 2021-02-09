import _memoize from 'fast-memoize'
import { MemoizeFunc } from 'fast-memoize/typings/fast-memoize'

// types that are not exported from fast-memoize
type Func = (...args: any[]) => any

interface Memoize extends MemoizeFunc {
  strategies: {
    variadic: MemoizeFunc
    monadic: MemoizeFunc
  }
}

export const memoize = _memoize as Memoize

// const passthrough = <T>(f: T) => f as T
// export const memoize = passthrough // for performance comparison
