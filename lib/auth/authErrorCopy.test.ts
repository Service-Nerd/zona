import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { authErrorCopy } from './authErrorCopy'

describe('authErrorCopy — the first screen a charity runner sees', () => {
  it('tells a first-time runner the account does not exist yet', () => {
    const out = authErrorCopy('Invalid login credentials', 'signin')
    expect(out).not.toBe('Invalid login credentials')
    expect(out).toMatch(/Sign up/)
  })

  it('tells a returning runner they already have one', () => {
    const out = authErrorCopy('User already registered', 'signup')
    expect(out).toMatch(/Sign in/)
  })

  it('does not cross the two over', () => {
    // The signin remedy is meaningless on the signup form and vice versa.
    expect(authErrorCopy('Invalid login credentials', 'signup')).toBe('Invalid login credentials')
    expect(authErrorCopy('User already registered', 'signin')).toBe('User already registered')
  })

  it('passes an unrecognised message through rather than hiding it', () => {
    const odd = 'Database error saving new user'
    expect(authErrorCopy(odd, 'signup')).toBe(odd)
  })

  it('the login screen actually uses it', () => {
    const src = readFileSync('app/auth/login/page.tsx', 'utf8')
    expect(src).toContain('authErrorCopy(')
    // No raw GoTrue string may reach setError on the password paths.
    const handler = src.slice(src.indexOf('async function handleEmail'), src.indexOf('async function signInWithApple'))
    expect(handler).not.toMatch(/setError\(error\.message\)/)
  })
})
