import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  title?: string
  assignedBy?: string
  limit?: string
  category?: string
  dueDate?: string
  notes?: string
  taskUrl?: string
}

function TaskAssigned({ title = 'Your club task', assignedBy = 'Your club', limit = 'Not set', category = 'General', dueDate = 'No due date', notes, taskUrl }: Props) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{assignedBy} assigned you {title}.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Club Ledger</Text>
          <Heading style={styles.heading}>{title}</Heading>
          <Text>{assignedBy} assigned this task to you. Thanks for helping out!</Text>
          <Text>Limit: {limit}<br />Category: {category}<br />Due: {dueDate}</Text>
          {notes && <Text>{notes}</Text>}
          {taskUrl && <Button href={taskUrl} style={styles.button}>View task</Button>}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TaskAssigned,
  subject: (data) => `New task: ${typeof data.title === 'string' ? data.title : 'Your club task'}`,
  displayName: 'Task assigned',
  previewData: {
    title: 'Pick up meeting supplies',
    assignedBy: 'Your treasurer',
    limit: '$25.00',
    category: 'Meetings',
    dueDate: 'Monday',
    notes: 'Please keep the receipt.',
  },
} satisfies TemplateEntry

const styles = {
  body: { backgroundColor: '#ffffff', color: '#202820', fontFamily: 'Arial, sans-serif' },
  container: { maxWidth: '560px', padding: '32px 24px' },
  brand: { color: '#195c43', fontSize: '18px', fontWeight: '700' },
  heading: { fontSize: '24px', lineHeight: '32px' },
  button: { backgroundColor: '#195c43', color: '#ffffff', borderRadius: '12px', padding: '12px 20px', fontWeight: '600' },
}