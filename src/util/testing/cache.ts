import fs from 'fs'
import path from 'path'
import { memoize } from '../memoize'

// TEST ASSETS
export const cache = <T>(fileName: string, generateAsset: () => T): T => {
  fileName = fileSystemSafe(fileName)
  const filePath = path.join(__dirname, `./assets/${fileName}.json`)

  // return cached object from assets folder if it exists
  if (fs.existsSync(filePath)) return parseCacheFile(filePath) as T

  // otherwise generate the asset
  const result: any = generateAsset()
  fs.writeFileSync(filePath, JSON.stringify(result))
  return result as T
}
const fileSystemSafe = (s: string) =>
  s
    .replace(/user/gi, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-/i, '')
    .replace(/-$/i, '')
    .toLowerCase()

const readFile = memoize((fileName: string) => fs.readFileSync(fileName).toString())

const parseCacheFile = (fileName: string) => JSON.parse(readFile(fileName))
