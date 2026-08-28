import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 360, padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>emakfabrika</h1>
        <LoginForm />
      </div>
    </div>
  );
}
