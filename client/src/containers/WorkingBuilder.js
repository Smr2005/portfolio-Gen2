import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Container, Row, Col, Card, Form, Button, Navbar, Nav, Alert, Tab, Tabs } from "react-bootstrap";
import Template1 from "../templates/Template1";
import Template2 from "../templates/Template2";
import Template3 from "../templates/Template3";
import Template4 from "../templates/Template4";
import Template5 from "../templates/Template5";
import Template6 from "../templates/Template6";
import { authenticatedFetch, isAuthenticated as checkAuth } from "../utils/auth";

function WorkingBuilder() {
  const history = useHistory();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const templateId = urlParams.get('template') || 'template1';
  const isEditMode = urlParams.get('edit') === 'true';

  const [userData, setUserData] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    website: "",
    profileImage: "",
    about: "",
    skills: [{ name: "", level: 50, category: "Technical" }],
    projects: [{ 
      title: "", 
      description: "", 
      tech: [""], 
      github: "", 
      demo: "", 
      image: "",
      featured: false
    }],
    experience: [{ 
      company: "", 
      position: "", 
      duration: "", 
      location: "", 
      description: "", 
      achievements: [""] 
    }],
    education: [{ 
      institution: "", 
      degree: "", 
      field: "", 
      duration: "", 
      location: "", 
      gpa: "", 
      description: "" 
    }],
    certifications: [{ 
      name: "", 
      issuer: "", 
      date: "", 
      url: "", 
      image: "" 
    }],
    internships: [{ 
      company: "", 
      position: "", 
      duration: "", 
      location: "", 
      description: "", 
      achievements: [""] 
    }]
  });

  const [activeTab, setActiveTab] = useState('personal');
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Template renderer function
  const renderTemplate = (userData, isPreview = false) => {
    const templateProps = { userData, isPreview };
    
    switch(templateId) {
      case 'template1':
        return <Template1 {...templateProps} />;
      case 'template2':
        return <Template2 {...templateProps} />;
      case 'template3':
        return <Template3 {...templateProps} />;
      case 'template4':
        return <Template4 {...templateProps} />;
      case 'template5':
        return <Template5 {...templateProps} />;
      case 'template6':
        return <Template6 {...templateProps} />;
      default:
        return <Template1 {...templateProps} />;
    }
  };

  useEffect(() => {
    // Check authentication from multiple sources
    const checkAuthentication = () => {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        setIsAuthenticated(true);
      } else {
        const authStatus = checkAuth();
        setIsAuthenticated(authStatus);
      }
    };
    
    checkAuthentication();
  }, []);

  // Load existing portfolio data if in edit mode
  useEffect(() => {
    if (isEditMode && isAuthenticated) {
      loadExistingPortfolio();
    }
  }, [isEditMode, isAuthenticated]);

  const loadExistingPortfolio = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      if (!token) return;

      const response = await fetch('/api/portfolio/my-portfolio', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.portfolio && data.portfolio.data) {
          setUserData(data.portfolio.data);
          console.log('Loaded existing portfolio data:', data.portfolio.data);
        }
      } else {
        console.log('No existing portfolio found or error loading portfolio');
      }
    } catch (err) {
      console.error('Error loading existing portfolio:', err);
    }
  };
  
  // Show login message if not authenticated (disabled for demo)
  if (false && !isAuthenticated) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6 text-center">
            <div className="card">
              <div className="card-body">
                <h3 className="card-title">🔒 Authentication Required</h3>
                <p className="card-text">Please log in to access the portfolio builder.</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => history.push('/')}
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (field, value) => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSkillChange = (index, field, value) => {
    const newSkills = [...userData.skills];
    newSkills[index] = { ...newSkills[index], [field]: value };
    setUserData(prev => ({
      ...prev,
      skills: newSkills
    }));
  };

  const addSkill = () => {
    setUserData(prev => ({
      ...prev,
      skills: [...prev.skills, { name: "", level: 50, category: "Technical" }]
    }));
  };

  const removeSkill = (index) => {
    const newSkills = userData.skills.filter((_, i) => i !== index);
    setUserData(prev => ({
      ...prev,
      skills: newSkills
    }));
  };

  const handleFileUpload = async (field, file) => {
    if (!file) return;

    try {
      setError('');
      
      if (!checkAuth()) {
        setError('Please login to upload files');
        return;
      }

      const formData = new FormData();
      
      // Determine the correct field name for the API
      let uploadField = field;
      if (field === 'profileImage') {
        uploadField = 'profileImage';
      } else if (field === 'resume') {
        uploadField = 'resume';
      } else if (field.startsWith('projectImage')) {
        uploadField = 'projectImage';
      } else if (field.startsWith('certImage')) {
        uploadField = 'certImage';
      }
      
      formData.append(uploadField, file);

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
      const API_BASE_URL = getApiUrl();

      // Determine the correct endpoint
      let endpoint = '/api/upload/';
      if (field === 'profileImage') {
        endpoint += 'profile-image';
      } else if (field === 'resume') {
        endpoint += 'resume';
      } else if (field.startsWith('projectImage')) {
        endpoint += 'project-image';
      } else if (field.startsWith('certImage')) {
        endpoint += 'certificate-image';
      }

      const response = await authenticatedFetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        if (field.startsWith('projectImage')) {
          const projectIndex = parseInt(field.replace('projectImage', ''));
          const newProjects = [...userData.projects];
          newProjects[projectIndex] = { ...newProjects[projectIndex], image: data.fileUrl };
          setUserData(prev => ({
            ...prev,
            projects: newProjects
          }));
        } else if (field.startsWith('certImage')) {
          const certIndex = parseInt(field.replace('certImage', ''));
          const newCertifications = [...userData.certifications];
          newCertifications[certIndex] = { ...newCertifications[certIndex], image: data.fileUrl };
          setUserData(prev => ({
            ...prev,
            certifications: newCertifications
          }));
        } else {
          setUserData(prev => ({
            ...prev,
            [field]: data.fileUrl
          }));
        }
      } else {
        const errorMsg = typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'Failed to upload file';
        setError(errorMsg);
      }
    } catch (err) {
      setError('File upload failed. Please try again.');
      console.error('Upload error:', err);
    }
  };

  const handleProjectChange = (index, field, value) => {
    const newProjects = [...userData.projects];
    newProjects[index] = { ...newProjects[index], [field]: value };
    setUserData(prev => ({
      ...prev,
      projects: newProjects
    }));
  };

  const addProject = () => {
    setUserData(prev => ({
      ...prev,
      projects: [...prev.projects, { 
        title: "", 
        description: "", 
        tech: [""], 
        github: "", 
        demo: "", 
        image: "",
        featured: false
      }]
    }));
  };

  const removeProject = (index) => {
    const newProjects = userData.projects.filter((_, i) => i !== index);
    setUserData(prev => ({
      ...prev,
      projects: newProjects
    }));
  };

  // Experience handlers
  const handleExperienceChange = (index, field, value) => {
    const newExperience = [...userData.experience];
    newExperience[index] = { ...newExperience[index], [field]: value };
    setUserData(prev => ({
      ...prev,
      experience: newExperience
    }));
  };

  const addExperience = () => {
    setUserData(prev => ({
      ...prev,
      experience: [...prev.experience, { 
        company: "", 
        position: "", 
        duration: "", 
        location: "", 
        description: "", 
        achievements: [""] 
      }]
    }));
  };

  const removeExperience = (index) => {
    const newExperience = userData.experience.filter((_, i) => i !== index);
    setUserData(prev => ({
      ...prev,
      experience: newExperience
    }));
  };

  const handleAchievementChange = (expIndex, achIndex, value) => {
    const newExperience = [...userData.experience];
    newExperience[expIndex].achievements[achIndex] = value;
    setUserData(prev => ({
      ...prev,
      experience: newExperience
    }));
  };

  const addAchievement = (expIndex) => {
    const newExperience = [...userData.experience];
    newExperience[expIndex].achievements.push("");
    setUserData(prev => ({
      ...prev,
      experience: newExperience
    }));
  };

  const removeAchievement = (expIndex, achIndex) => {
    const newExperience = [...userData.experience];
    newExperience[expIndex].achievements = newExperience[expIndex].achievements.filter((_, i) => i !== achIndex);
    setUserData(prev => ({
      ...prev,
      experience: newExperience
    }));
  };

  // Certification handlers
  const handleCertificationChange = (index, field, value) => {
    const newCertifications = [...userData.certifications];
    newCertifications[index] = { ...newCertifications[index], [field]: value };
    setUserData(prev => ({
      ...prev,
      certifications: newCertifications
    }));
  };

  const addCertification = () => {
    setUserData(prev => ({
      ...prev,
      certifications: [...prev.certifications, { 
        name: "", 
        issuer: "", 
        date: "", 
        url: "", 
        image: "" 
      }]
    }));
  };

  const removeCertification = (index) => {
    const newCertifications = userData.certifications.filter((_, i) => i !== index);
    setUserData(prev => ({
      ...prev,
      certifications: newCertifications
    }));
  };

  // Internship handlers
  const handleInternshipChange = (index, field, value) => {
    const newInternships = [...userData.internships];
    newInternships[index] = { ...newInternships[index], [field]: value };
    setUserData(prev => ({
      ...prev,
      internships: newInternships
    }));
  };

  const addInternship = () => {
    setUserData(prev => ({
      ...prev,
      internships: [...prev.internships, { 
        company: "", 
        position: "", 
        duration: "", 
        location: "", 
        description: "", 
        achievements: [""] 
      }]
    }));
  };

  const removeInternship = (index) => {
    const newInternships = userData.internships.filter((_, i) => i !== index);
    setUserData(prev => ({
      ...prev,
      internships: newInternships
    }));
  };

  const handleInternshipAchievementChange = (intIndex, achIndex, value) => {
    const newInternships = [...userData.internships];
    newInternships[intIndex].achievements[achIndex] = value;
    setUserData(prev => ({
      ...prev,
      internships: newInternships
    }));
  };

  const addInternshipAchievement = (intIndex) => {
    const newInternships = [...userData.internships];
    newInternships[intIndex].achievements.push("");
    setUserData(prev => ({
      ...prev,
      internships: newInternships
    }));
  };

  const removeInternshipAchievement = (intIndex, achIndex) => {
    const newInternships = [...userData.internships];
    newInternships[intIndex].achievements = newInternships[intIndex].achievements.filter((_, i) => i !== achIndex);
    setUserData(prev => ({
      ...prev,
      internships: newInternships
    }));
  };

  // Education handlers
  const handleEducationChange = (index, field, value) => {
    const newEducation = [...userData.education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setUserData(prev => ({
      ...prev,
      education: newEducation
    }));
  };

  const addEducation = () => {
    setUserData(prev => ({
      ...prev,
      education: [...prev.education, { 
        institution: "", 
        degree: "", 
        field: "", 
        duration: "", 
        location: "", 
        gpa: "", 
        description: "" 
      }]
    }));
  };

  const removeEducation = (index) => {
    const newEducation = userData.education.filter((_, i) => i !== index);
    setUserData(prev => ({
      ...prev,
      education: newEducation
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      if (!checkAuth()) {
        setError('Please login to save your portfolio');
        return;
      }

      if (!userData.name || !userData.title || !userData.email) {
        setError('Please fill in all required fields (Name, Title, Email)');
        return;
      }

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
      const API_BASE_URL = getApiUrl();

      const response = await authenticatedFetch(`${API_BASE_URL}/api/portfolio/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId,
          data: userData
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const errorMsg = typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'Failed to save portfolio';
        setError(errorMsg);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      setError('');
      
      if (!checkAuth()) {
        setError('Please login to publish your portfolio');
        return;
      }

      // First save the portfolio if there are unsaved changes
      if (!saved) {
        await handleSave();
      }

      // Get API base URL (same logic as file upload)
      const getApiUrl = () => {
        if (process.env.REACT_APP_API_URL) {
          return process.env.REACT_APP_API_URL;
        }
        if (process.env.NODE_ENV === 'production') {
          return window.location.origin;
        }
        return 'http://localhost:5000';
      };
      const API_BASE_URL = getApiUrl();

      const response = await authenticatedFetch(`${API_BASE_URL}/api/portfolio/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setPublished(true);
        setPublishedUrl(data.publishedUrl);
        setTimeout(() => setPublished(false), 5000);
      } else {
        const errorMsg = typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'Failed to publish portfolio';
        setError(errorMsg);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Publish error:', err);
    } finally {
      setPublishing(false);
    }
  };

  if (false && !isAuthenticated) {
    return (
      <Container className="mt-5">
        <Alert variant="warning">
          <h4>Authentication Required</h4>
          <p>Please login to access the portfolio builder.</p>
          <Button variant="primary" onClick={() => history.push('/')}>
            Go to Login
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <div>
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4" style={{ zIndex: 1000 }}>
        <Navbar.Brand>
          {isEditMode ? 'Edit Portfolio' : 'Portfolio Builder'}
          <span className="badge badge-secondary ml-2" style={{fontSize: '0.7em'}}>
            {templateId.charAt(0).toUpperCase() + templateId.slice(1)}
          </span>
          {isEditMode && (
            <span className="badge badge-warning ml-2" style={{fontSize: '0.7em'}}>
              Edit Mode
            </span>
          )}
        </Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse>
          <Nav className="ml-auto">
            <Button 
              variant="outline-light" 
              className="mr-2"
              onClick={() => setShowPreview(!showPreview)}
              style={{ zIndex: 1001 }}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
            <Button 
              variant="success" 
              className="mr-2"
              onClick={handleSave}
              disabled={saving}
              style={{ zIndex: 1001 }}
            >
              {saving ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}
            </Button>
            <Button 
              variant="primary" 
              className="mr-2"
              onClick={handlePublish}
              disabled={publishing || !userData.name || !userData.title || !userData.email}
              style={{ zIndex: 1001 }}
            >
              {publishing ? 'Publishing...' : (isEditMode ? '🔄 Update & Publish' : '🚀 Publish')}
            </Button>
          </Nav>
        </Navbar.Collapse>
      </Navbar>

      <Container fluid>
        {error && <Alert variant="danger">{typeof error === 'string' ? error : error.message || JSON.stringify(error)}</Alert>}
        {saved && <Alert variant="success">Portfolio saved successfully!</Alert>}
        {published && (
          <Alert variant="success">
            <h5>🎉 Portfolio Published Successfully!</h5>
            <p>Your portfolio is now live and accessible to everyone!</p>
            <p><strong>Published URL:</strong> <a href={publishedUrl} target="_blank" rel="noopener noreferrer">{publishedUrl}</a></p>
            <p><small>📧 A detailed email with your portfolio link and sharing options has been sent to your email address.</small></p>
          </Alert>
        )}

        <Row>
          {!showPreview && (
            <Col md={6}>
              <Card>
                <Card.Header>
                  <h5>Portfolio Information</h5>
                </Card.Header>
                <Card.Body>
                  <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                    <Tabs 
                      activeKey={activeTab} 
                      onSelect={setActiveTab} 
                      className="mb-3" 
                      variant="pills"
                      style={{ flexWrap: 'nowrap', minWidth: 'max-content' }}
                    >
                    
                    <Tab eventKey="personal" title="👤 Personal">
                      <div className="mt-3">
                        <Form.Group className="mb-3">
                          <Form.Label>Full Name *</Form.Label>
                          <Form.Control
                            type="text"
                            value={userData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            required
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Professional Title *</Form.Label>
                          <Form.Control
                            type="text"
                            value={userData.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="e.g., Full Stack Developer"
                            required
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Email *</Form.Label>
                          <Form.Control
                            type="email"
                            value={userData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            required
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Profile Picture</Form.Label>
                          <Form.Control
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload('profileImage', e.target.files[0])}
                          />
                          {userData.profileImage && (
                            <img 
                              src={userData.profileImage} 
                              alt="Profile" 
                              style={{width: '100px', height: '100px', objectFit: 'cover', marginTop: '10px', borderRadius: '50%'}}
                            />
                          )}
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Resume (PDF)</Form.Label>
                          <Form.Control
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleFileUpload('resume', e.target.files[0])}
                          />
                          {userData.resume && (
                            <div className="mt-2">
                              <a href={userData.resume} target="_blank" rel="noopener noreferrer">
                                📄 View Resume
                              </a>
                            </div>
                          )}
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Phone</Form.Label>
                          <Form.Control
                            type="tel"
                            value={userData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="+1 (555) 123-4567"
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label>Location</Form.Label>
                          <Form.Control
                            type="text"
                            value={userData.location}
                            onChange={(e) => handleInputChange('location', e.target.value)}
                            placeholder="City, State/Country"
                          />
                        </Form.Group>

                        <Row>
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label>LinkedIn</Form.Label>
                              <Form.Control
                                type="url"
                                value={userData.linkedin}
                                onChange={(e) => handleInputChange('linkedin', e.target.value)}
                                placeholder="https://linkedin.com/in/username"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label>GitHub</Form.Label>
                              <Form.Control
                                type="url"
                                value={userData.github}
                                onChange={(e) => handleInputChange('github', e.target.value)}
                                placeholder="https://github.com/username"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label>Website</Form.Label>
                              <Form.Control
                                type="url"
                                value={userData.website}
                                onChange={(e) => handleInputChange('website', e.target.value)}
                                placeholder="https://yourwebsite.com"
                              />
                            </Form.Group>
                          </Col>
                        </Row>

                        <Form.Group className="mb-3">
                          <Form.Label>About Me</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={4}
                            value={userData.about}
                            onChange={(e) => handleInputChange('about', e.target.value)}
                            placeholder="Tell us about yourself..."
                          />
                        </Form.Group>
                      </div>
                    </Tab>

                    <Tab eventKey="skills" title="🛠️ Skills">
                      <div className="mt-3">
                        {userData.skills.map((skill, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Body>
                              <Row>
                                <Col md={4}>
                                  <Form.Group>
                                    <Form.Label>Skill Name</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={skill.name}
                                      onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                                      placeholder="e.g., JavaScript"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={3}>
                                  <Form.Group>
                                    <Form.Label>Proficiency Level</Form.Label>
                                    <Form.Control
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={skill.level}
                                      onChange={(e) => handleSkillChange(index, 'level', parseInt(e.target.value))}
                                    />
                                    <small>{skill.level}%</small>
                                  </Form.Group>
                                </Col>
                                <Col md={3}>
                                  <Form.Group>
                                    <Form.Label>Category</Form.Label>
                                    <Form.Control
                                      as="select"
                                      value={skill.category}
                                      onChange={(e) => handleSkillChange(index, 'category', e.target.value)}
                                    >
                                      <option value="Technical">Technical</option>
                                      <option value="Soft Skills">Soft Skills</option>
                                      <option value="Languages">Languages</option>
                                      <option value="Tools">Tools</option>
                                    </Form.Control>
                                  </Form.Group>
                                </Col>
                                <Col md={2}>
                                  <Form.Label>&nbsp;</Form.Label>
                                  <Button 
                                    variant="danger" 
                                    size="sm" 
                                    className="d-block"
                                    onClick={() => removeSkill(index)}
                                  >
                                    Remove
                                  </Button>
                                </Col>
                              </Row>
                            </Card.Body>
                          </Card>
                        ))}
                        <Button variant="outline-primary" onClick={addSkill}>
                          Add Skill
                        </Button>
                      </div>
                    </Tab>

                    <Tab eventKey="projects" title="💼 Projects">
                      <div className="mt-3">
                        {userData.projects.map((project, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Body>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Project Title</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={project.title}
                                      onChange={(e) => handleProjectChange(index, 'title', e.target.value)}
                                      placeholder="e.g., E-commerce Platform"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Project Image</Form.Label>
                                    <Form.Control
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleFileUpload(`projectImage${index}`, e.target.files[0])}
                                    />
                                    {project.image && (
                                      <img 
                                        src={project.image} 
                                        alt="Project" 
                                        style={{width: '100px', height: '60px', objectFit: 'cover', marginTop: '10px'}}
                                      />
                                    )}
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Form.Group className="mb-3">
                                <Form.Label>Description</Form.Label>
                                <Form.Control
                                  as="textarea"
                                  rows={3}
                                  value={project.description}
                                  onChange={(e) => handleProjectChange(index, 'description', e.target.value)}
                                  placeholder="Describe your project..."
                                />
                              </Form.Group>

                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>GitHub Repository</Form.Label>
                                    <Form.Control
                                      type="url"
                                      value={project.github}
                                      onChange={(e) => handleProjectChange(index, 'github', e.target.value)}
                                      placeholder="https://github.com/username/project"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Live Demo URL</Form.Label>
                                    <Form.Control
                                      type="url"
                                      value={project.demo}
                                      onChange={(e) => handleProjectChange(index, 'demo', e.target.value)}
                                      placeholder="https://your-project-demo.com"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Form.Group className="mb-3">
                                <Form.Label>Technologies Used (comma-separated)</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={Array.isArray(project.tech) ? project.tech.join(', ') : project.tech}
                                  onChange={(e) => handleProjectChange(index, 'tech', e.target.value.split(',').map(t => t.trim()))}
                                  placeholder="React, Node.js, MongoDB, Express"
                                />
                              </Form.Group>

                              <Form.Group className="mb-3">
                                <Form.Check
                                  type="checkbox"
                                  label="Featured Project"
                                  checked={project.featured}
                                  onChange={(e) => handleProjectChange(index, 'featured', e.target.checked)}
                                />
                              </Form.Group>

                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => removeProject(index)}
                              >
                                Remove Project
                              </Button>
                            </Card.Body>
                          </Card>
                        ))}
                        <Button variant="outline-primary" onClick={addProject}>
                          Add Project
                        </Button>
                      </div>
                    </Tab>

                    <Tab eventKey="experience" title="💼 Experience">
                      <div className="mt-3">
                        {userData.experience.map((exp, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Body>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Company</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={exp.company}
                                      onChange={(e) => handleExperienceChange(index, 'company', e.target.value)}
                                      placeholder="e.g., Google Inc."
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Position</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={exp.position}
                                      onChange={(e) => handleExperienceChange(index, 'position', e.target.value)}
                                      placeholder="e.g., Senior Software Engineer"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Duration</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={exp.duration}
                                      onChange={(e) => handleExperienceChange(index, 'duration', e.target.value)}
                                      placeholder="e.g., Jan 2022 - Present"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Location</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={exp.location}
                                      onChange={(e) => handleExperienceChange(index, 'location', e.target.value)}
                                      placeholder="e.g., San Francisco, CA"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Form.Group className="mb-3">
                                <Form.Label>Description</Form.Label>
                                <Form.Control
                                  as="textarea"
                                  rows={3}
                                  value={exp.description}
                                  onChange={(e) => handleExperienceChange(index, 'description', e.target.value)}
                                  placeholder="Describe your role and responsibilities..."
                                />
                              </Form.Group>

                              <Form.Group className="mb-3">
                                <Form.Label>Key Achievements</Form.Label>
                                {exp.achievements.map((achievement, achIndex) => (
                                  <div key={achIndex} className="mb-2 d-flex">
                                    <Form.Control
                                      type="text"
                                      value={achievement}
                                      onChange={(e) => handleAchievementChange(index, achIndex, e.target.value)}
                                      placeholder="e.g., Increased performance by 50%"
                                      className="mr-2"
                                    />
                                    <Button 
                                      variant="outline-danger" 
                                      size="sm"
                                      onClick={() => removeAchievement(index, achIndex)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                                <Button 
                                  variant="outline-secondary" 
                                  size="sm"
                                  onClick={() => addAchievement(index)}
                                >
                                  Add Achievement
                                </Button>
                              </Form.Group>

                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => removeExperience(index)}
                              >
                                Remove Experience
                              </Button>
                            </Card.Body>
                          </Card>
                        ))}
                        <Button variant="outline-primary" onClick={addExperience}>
                          Add Experience
                        </Button>
                      </div>
                    </Tab>

                    <Tab eventKey="certifications" title="🏆 Certs">
                      <div className="mt-3">
                        {userData.certifications.map((cert, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Body>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Certification Name</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={cert.name}
                                      onChange={(e) => handleCertificationChange(index, 'name', e.target.value)}
                                      placeholder="e.g., AWS Solutions Architect"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Issuing Organization</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={cert.issuer}
                                      onChange={(e) => handleCertificationChange(index, 'issuer', e.target.value)}
                                      placeholder="e.g., Amazon Web Services"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Date Obtained</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={cert.date}
                                      onChange={(e) => handleCertificationChange(index, 'date', e.target.value)}
                                      placeholder="e.g., 2023 or Jan 2023"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Verification URL</Form.Label>
                                    <Form.Control
                                      type="url"
                                      value={cert.url}
                                      onChange={(e) => handleCertificationChange(index, 'url', e.target.value)}
                                      placeholder="https://certification-verification-url.com"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Form.Group className="mb-3">
                                <Form.Label>Certificate Image</Form.Label>
                                <Form.Control
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileUpload(`certImage${index}`, e.target.files[0])}
                                />
                                {cert.image && (
                                  <img 
                                    src={cert.image} 
                                    alt="Certificate" 
                                    style={{width: '150px', height: '100px', objectFit: 'cover', marginTop: '10px'}}
                                  />
                                )}
                              </Form.Group>

                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => removeCertification(index)}
                              >
                                Remove Certification
                              </Button>
                            </Card.Body>
                          </Card>
                        ))}
                        <Button variant="outline-primary" onClick={addCertification}>
                          Add Certification
                        </Button>
                      </div>
                    </Tab>

                    <Tab eventKey="internships" title="🚀 Internships">
                      <div className="mt-3">
                        {userData.internships.map((internship, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Body>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Company</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={internship.company}
                                      onChange={(e) => handleInternshipChange(index, 'company', e.target.value)}
                                      placeholder="e.g., Microsoft"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Position</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={internship.position}
                                      onChange={(e) => handleInternshipChange(index, 'position', e.target.value)}
                                      placeholder="e.g., Software Engineering Intern"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Duration</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={internship.duration}
                                      onChange={(e) => handleInternshipChange(index, 'duration', e.target.value)}
                                      placeholder="e.g., Summer 2023 (3 months)"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Location</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={internship.location}
                                      onChange={(e) => handleInternshipChange(index, 'location', e.target.value)}
                                      placeholder="e.g., Seattle, WA"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Form.Group className="mb-3">
                                <Form.Label>Description</Form.Label>
                                <Form.Control
                                  as="textarea"
                                  rows={3}
                                  value={internship.description}
                                  onChange={(e) => handleInternshipChange(index, 'description', e.target.value)}
                                  placeholder="Describe your internship experience..."
                                />
                              </Form.Group>

                              <Form.Group className="mb-3">
                                <Form.Label>Key Achievements</Form.Label>
                                {internship.achievements.map((achievement, achIndex) => (
                                  <div key={achIndex} className="mb-2 d-flex">
                                    <Form.Control
                                      type="text"
                                      value={achievement}
                                      onChange={(e) => handleInternshipAchievementChange(index, achIndex, e.target.value)}
                                      placeholder="e.g., Built a feature used by 10,000+ users"
                                      className="mr-2"
                                    />
                                    <Button 
                                      variant="outline-danger" 
                                      size="sm"
                                      onClick={() => removeInternshipAchievement(index, achIndex)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                                <Button 
                                  variant="outline-secondary" 
                                  size="sm"
                                  onClick={() => addInternshipAchievement(index)}
                                >
                                  Add Achievement
                                </Button>
                              </Form.Group>

                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => removeInternship(index)}
                              >
                                Remove Internship
                              </Button>
                            </Card.Body>
                          </Card>
                        ))}
                        <Button variant="outline-primary" onClick={addInternship}>
                          Add Internship
                        </Button>
                      </div>
                    </Tab>

                    <Tab eventKey="education" title="🎓 Education">
                      <div className="mt-3">
                        {userData.education.map((edu, index) => (
                          <Card key={index} className="mb-3">
                            <Card.Body>
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Institution</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={edu.institution}
                                      onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                                      placeholder="e.g., Stanford University"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Degree</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={edu.degree}
                                      onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                                      placeholder="e.g., Master of Science"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Field of Study</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={edu.field}
                                      onChange={(e) => handleEducationChange(index, 'field', e.target.value)}
                                      placeholder="e.g., Computer Science"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Duration</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={edu.duration}
                                      onChange={(e) => handleEducationChange(index, 'duration', e.target.value)}
                                      placeholder="e.g., 2016-2020"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Location</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={edu.location}
                                      onChange={(e) => handleEducationChange(index, 'location', e.target.value)}
                                      placeholder="e.g., Stanford, CA"
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>GPA (Optional)</Form.Label>
                                    <Form.Control
                                      type="text"
                                      value={edu.gpa}
                                      onChange={(e) => handleEducationChange(index, 'gpa', e.target.value)}
                                      placeholder="e.g., 3.8/4.0"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Form.Group className="mb-3">
                                <Form.Label>Description</Form.Label>
                                <Form.Control
                                  as="textarea"
                                  rows={3}
                                  value={edu.description}
                                  onChange={(e) => handleEducationChange(index, 'description', e.target.value)}
                                  placeholder="Describe your studies, achievements, thesis, etc..."
                                />
                              </Form.Group>

                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => removeEducation(index)}
                              >
                                Remove Education
                              </Button>
                            </Card.Body>
                          </Card>
                        ))}
                        <Button variant="outline-primary" onClick={addEducation}>
                          Add Education
                        </Button>
                      </div>
                    </Tab>

                    </Tabs>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          )}
          
          <Col md={showPreview ? 12 : 6}>
            <Card>
              <Card.Header>
                <h5>Portfolio Preview</h5>
              </Card.Header>
              <Card.Body style={{ maxHeight: '80vh', overflow: 'auto', position: 'relative', zIndex: 1 }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  {renderTemplate(userData, true)}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default WorkingBuilder;