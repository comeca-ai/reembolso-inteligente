import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Link href={siteUrl} style={brand}>
            reembolso<span style={brandAccent}>.ia.br</span>
          </Link>
        </Section>
        <Heading style={h1}>Você foi convidado</Heading>
        <Text style={text}>
          Você recebeu um convite para acessar o{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Clique no botão abaixo para aceitar o convite e criar sua senha de
          acesso.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Aceitar convite
        </Button>
        <Text style={footer}>
          Se você não esperava este convite, pode ignorar este e-mail com
          segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#f4f7f7', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2eaea',
  padding: '32px 28px',
  margin: '24px auto',
  maxWidth: '480px',
}
const header = { margin: '0 0 24px' }
const brand = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#0e7c7b',
  textDecoration: 'none',
}
const brandAccent = { color: '#0f2e2e' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0f2e2e',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55656a',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#0e7c7b', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0e7c7b',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '13px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#9aa7aa', margin: '28px 0 0' }
