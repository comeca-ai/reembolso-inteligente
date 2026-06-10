import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefina sua senha do {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>
            reembolso<span style={brandAccent}>.ia.br</span>
          </Text>
        </Section>
        <Heading style={h1}>Redefina sua senha</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha da sua conta no {siteName}.
          Clique no botão abaixo para escolher uma nova senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Redefinir senha
        </Button>
        <Text style={footer}>
          Se você não solicitou a redefinição, pode ignorar este e-mail com
          segurança. Sua senha permanecerá a mesma.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
