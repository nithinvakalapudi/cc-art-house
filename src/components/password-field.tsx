'use client';
import { useState } from 'react';
type Props = React.InputHTMLAttributes<HTMLInputElement>;
export default function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field-wrap"><input {...props} type={visible ? 'text' : 'password'} /><button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button></span>;
}
