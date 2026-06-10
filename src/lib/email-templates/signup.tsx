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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Link href={siteUrl} style={brand}>
            reembolso<span style={brandAccent}>.ia.br</span>
          </Link>
        </Section>
        <Heading style={h1}>Confirme seu e-mail</Heading>
        <Text style={text}>
          Obrigado por se cadastrar no{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Para ativar sua conta ({recipient}), confirme seu endereço de e-mail
          clicando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar e-mail
        </Button>
        <Text style={footer}>
          Se você não criou esta conta, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
