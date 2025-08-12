import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import M from 'materialize-css';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const history = useHistory();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password.length < 5) {
      setError('Password must be at least 5 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
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
      
      const response = await fetch(`${getApiUrl()}/api/user/new-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          password,
          token 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password updated successfully! Redirecting to login...');
        M.toast({html: 'Password updated successfully!', classes: '#4caf50 green'});
        setTimeout(() => {
          history.push('/');
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

  return (
    <Container className="mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <Card>
            <Card.Header>
              <h3 className="text-center">Reset Your Password</h3>
            </Card.Header>
            <Card.Body>
              {message && <Alert variant="success">{message}</Alert>}
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={5}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={5}
                  />
                </Form.Group>

                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading || !password || !confirmPassword}
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </Form>

              <div className="text-center mt-3">
                <Button 
                  variant="link" 
                  onClick={() => history.push('/')}
                >
                  Back to Home
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </Container>
  );
};

export default ResetPasswordPage;