import { expect } from 'expect'

import { parse, write } from '../lib/index.js'
import { collect } from './util/collect.js'

describe('Parses all of the syntax IDLs to produce the correct ASTs', () => {
  for (const test of collect('syntax')) {
    it(`should produce the same AST for ${test.path}`, () => {
      expect(test.diff()).toBeFalsy()
    })
  }
})

describe('Rewrite and parses all of the IDLs to produce the same ASTs', () => {
  for (const test of collect('syntax')) {
    it(`should produce the same AST for ${test.path}`, () => {
      const rewritten = write(test.ast)
      expect(rewritten).toEqual(test.text)
      const diff = test.diff(parse(rewritten, test.baselinePath))
      expect(diff).toBe(undefined)
    })
  }
})
