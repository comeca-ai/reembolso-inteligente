import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>
            reembolso<span style={brandAccent}>.ia.br</span>
          </Text>
        </Section>
        <Heading style={h1}>Confirme sua identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em alguns minutos. Se você não solicitou, pode
          ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
  margin: '0',
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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '26px',
  fontWeight: 'bold' as const,
  letterSpacing: '4px',
  color: '#0e7c7b',
  backgroundColor: '#eef6f6',
  borderRadius: '8px',
  padding: '14px 0',
  textAlign: 'center' as const,
  margin: '0 0 28px',
}
const footer = { fontSize: '12px', color: '#9aa7aa', margin: '28px 0 0' }
