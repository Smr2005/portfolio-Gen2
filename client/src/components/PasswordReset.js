import React, { useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import M from 'materialize-css';

const PasswordReset = ({ show, handleClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Get API base URL
      const getApiUrl = () => {
        if (process.env.REACT_APP_API_URL) {
          return process.env.REACT_APP_API_URL;
        }
        if (process.env.NODE_ENV === 'production') {
          return window.location.origin;
        }
        return 'http://localhost:5000';
      };
      
      const response = await fetch(`${getApiUrl()}/api/user/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password reset email sent! Check your inbox.');
        M.toast({html: 'Password reset email sent!', classes: '#4caf50 green'});
        setTimeout(() => {
          handleClose();
          setEmail('');
          setMessage('');
        }, 2000);
      } else {
        setError(data.error || 'Something went wrong');
        M.toast({html: data.error || 'Something went wrong', classes: '#f44336 red'});
      }
    } catch (err) {
      setError('Network error. Please try again.');
      M.toast({html: 'Network error. Please try again.', classes: '#f44336 red'});
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setEmail('');
    setMessage('');
    setError('');
    handleClose();
  };

  return (
    <Modal 
      show={show} 
      onHide={handleModalClose} 
      backdrop="static" 
      keyboard={false}
      dialogClassName={window.innerWidth < 768 ? "mobile-modal" : ""}
      style={window.innerWidth < 768 ? {
        '--bs-modal-width': '90%',
        '--bs-modal-margin': '0.5rem'
      } : {}}
    >
      <Modal.Header closeButton>
        <Modal.Title style={{
          fontSize: window.innerWidth < 480 ? '1.2rem' : window.innerWidth < 768 ? '1.4rem' : '1.5rem'
        }}>
          🔐 Reset Password
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{
        padding: window.innerWidth < 480 ? '1rem' : '1.5rem'
      }}>
        {message && <Alert variant="success" style={{
          fontSize: window.innerWidth < 480 ? '0.9rem' : '1rem',
          padding: window.innerWidth < 480 ? '0.75rem' : '1rem'
        }}>{message}</Alert>}
        {error && <Alert variant="danger" style={{
          fontSize: window.innerWidth < 480 ? '0.9rem' : '1rem',
          padding: window.innerWidth < 480 ? '0.75rem' : '1rem'
        }}>{error}</Alert>}
        
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="resetEmail">
            <Form.Label style={{
              fontSize: window.innerWidth < 480 ? '0.9rem' : '1rem',
              marginBottom: '0.5rem'
            }}>
              Email address
            </Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                fontSize: '16px', // Prevent zoom on iOS
                padding: window.innerWidth < 480 ? '0.75rem' : '0.875rem',
                minHeight: window.innerWidth < 768 ? '44px' : 'auto'
              }}
            />
            <Form.Text 
              className="text-muted"
              style={{
                fontSize: window.innerWidth < 480 ? '0.8rem' : '0.875rem',
                marginTop: '0.5rem'
              }}
            >
              We'll send you a link to reset your password.
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer style={{
        padding: window.innerWidth < 480 ? '1rem' : '1.5rem',
        gap: window.innerWidth < 768 ? '0.5rem' : '0',
        flexDirection: window.innerWidth < 768 ? 'column' : 'row'
      }}>
        <Button 
          variant="secondary" 
          onClick={handleModalClose} 
          disabled={loading}
          style={{
            minHeight: '44px',
            fontSize: window.innerWidth < 480 ? '0.9rem' : '1rem',
            padding: window.innerWidth < 480 ? '0.75rem 1rem' : '0.875rem 1.25rem',
            width: window.innerWidth < 768 ? '100%' : 'auto',
            order: window.innerWidth < 768 ? 2 : 1
          }}
        >
          ❌ Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit} 
          disabled={loading || !email}
          style={{
            minHeight: '44px',
            fontSize: window.innerWidth < 480 ? '0.9rem' : '1rem',
            padding: window.innerWidth < 480 ? '0.75rem 1rem' : '0.875rem 1.25rem',
            width: window.innerWidth < 768 ? '100%' : 'auto',
            order: window.innerWidth < 768 ? 1 : 2
          }}
        >
          {loading ? '📧 Sending...' : '📧 Send Reset Link'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PasswordReset;