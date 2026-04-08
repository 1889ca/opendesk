/** Contract: contracts/federation/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapIdentity,
  parseSAMLAssertion,
  createInMemoryIdentityStore,
  type IdentityStore,
} from './identity-federation.ts';

describe('identity-federation', () => {
  let store: IdentityStore;

  beforeEach(() => {
    store = createInMemoryIdentityStore();
  });

  describe('mapIdentity', () => {
    it('creates a new identity mapping', async () => {
      const identity = await mapIdentity(store, 'local-user-1', 'remote-instance', 'remote-user-1', 'oidc');
      expect(identity.localUserId).toBe('local-user-1');
      expect(identity.remoteInstanceId).toBe('remote-instance');
      expect(identity.remoteUserId).toBe('remote-user-1');
      expect(identity.provider).toBe('oidc');
      expect(identity.verifiedAt).toBeTruthy();
    });

    it('returns existing mapping for same remote user', async () => {
      const first = await mapIdentity(store, 'local-1', 'remote-inst', 'remote-user', 'oidc');
      const second = await mapIdentity(store, 'local-1', 'remote-inst', 'remote-user', 'oidc');
      expect(first.id).toBe(second.id);
    });

    it('allows different remote users to map to different locals', async () => {
      const a = await mapIdentity(store, 'local-1', 'remote-inst', 'remote-user-a', 'oidc');
      const b = await mapIdentity(store, 'local-2', 'remote-inst', 'remote-user-b', 'oidc');
      expect(a.id).not.toBe(b.id);
    });

    it('finds identities by local user', async () => {
      await mapIdentity(store, 'local-1', 'inst-a', 'user-a', 'oidc');
      await mapIdentity(store, 'local-1', 'inst-b', 'user-b', 'saml');
      const found = await store.findByLocal('local-1');
      expect(found).toHaveLength(2);
    });
  });

  describe('parseSAMLAssertion', () => {
    const certBase64 = 'MIIBfakeBase64CertContent==';

    it('rejects assertion without signature', () => {
      const xml = `<saml:Assertion>
        <saml:Issuer>https://idp.example.com</saml:Issuer>
        <saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject>
      </saml:Assertion>`;
      const result = parseSAMLAssertion(xml, certBase64);
      expect(result.ok).toBe(false);
    });

    it('rejects assertion without issuer', () => {
      const xml = `<saml:Assertion>
        <saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject>
        <ds:SignatureValue>fakesig==</ds:SignatureValue>
      </saml:Assertion>`;
      const result = parseSAMLAssertion(xml, certBase64);
      expect(result.ok).toBe(false);
    });

    it('rejects when no trusted cert provided', () => {
      const xml = `<saml:Assertion>
        <saml:Issuer>https://idp.example.com</saml:Issuer>
        <saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject>
        <ds:SignatureValue>fakesig==</ds:SignatureValue>
      </saml:Assertion>`;
      const result = parseSAMLAssertion(xml, '');
      expect(result.ok).toBe(false);
    });

    it('parses valid assertion with matching cert', () => {
      const xml = `<saml:Assertion>
        <saml:Issuer>https://idp.example.com</saml:Issuer>
        <saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject>
        <ds:SignatureValue>fakesig==</ds:SignatureValue>
        <ds:X509Certificate>${certBase64}</ds:X509Certificate>
        <saml:Attribute Name="email"><saml:AttributeValue>user@example.com</saml:AttributeValue></saml:Attribute>
      </saml:Assertion>`;
      const result = parseSAMLAssertion(xml, certBase64);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.subject).toBe('user@example.com');
        expect(result.issuer).toBe('https://idp.example.com');
        expect(result.attributes.email).toBe('user@example.com');
      }
    });

    it('rejects assertion with mismatched cert', () => {
      const xml = `<saml:Assertion>
        <saml:Issuer>https://idp.example.com</saml:Issuer>
        <saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject>
        <ds:SignatureValue>fakesig==</ds:SignatureValue>
        <ds:X509Certificate>DifferentCert==</ds:X509Certificate>
      </saml:Assertion>`;
      const result = parseSAMLAssertion(xml, certBase64);
      expect(result.ok).toBe(false);
    });
  });
});
