import React, { useState, useEffect,useContext } from "react";
import { Navbar, Nav, Button, Carousel, Modal, Form } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import "../stylesheets/landingstyle.css";
import { images } from "./images";
import "aos/dist/aos.css";
import Aos from "aos";
import M from 'materialize-css'
import {UserContext} from '../context/UserContext'
import PasswordReset from './PasswordReset'

const Landing=()=> {
const {state,dispatch} = useContext(UserContext)
const history = useHistory()

  const [navbar, setNavbar] = useState(false);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [password,setPassword]= useState("")
  const [email,setEmail]= useState("")
  const [name,setName]= useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [registerError, setRegisterError] = useState("")

  const handleClose = () => {
    setShow(false);
    setLoginError("");
    setEmail("");
    setPassword("");
  };
  const handleShow = () => {
    setShow(true);
    setLoginError("");
  };
  const handleCloseRegister = () => {
    setShowRegister(false);
    setRegisterError("");
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };
  const handleShowRegister = () => {
    setShowRegister(true);
    setRegisterError("");
  };

  const handleSelect = (selectedIndex, e) => {
    setIndex(selectedIndex);
  };

  const changeBackground = () => {
    if (window.scrollY >= 80) {
      setNavbar(true);
    } else {
      setNavbar(false);
    }
  };

  window.addEventListener("scroll", changeBackground);

  useEffect(() => {
    Aos.init({ duration: 1000 });
  }, []);


const PostData=()=>{
    setLoginError("")
    setIsLoading(true)
    
    // Validation
    if(!/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)){
       setIsLoading(false)
       return setLoginError("Please enter a valid email address")
    }
    if(!password || password.length < 5){
        setIsLoading(false)
        return setLoginError("Password must be at least 5 characters long")
    }

    console.log("Sending login data:", {email, password: "***"});
    
    fetch("http://localhost:5000/api/user/login",{
        method:'post',
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            password,
            email
        })
    })
    .then(res=>{
        console.log("Login response status:", res.status);
        console.log("Login response content-type:", res.headers.get("content-type"));
        
        // Handle different response types
        if (res.status === 404) {
            // User not found
            setLoginError("User not found. Please check your email or register first.")
            setIsLoading(false)
            return Promise.reject(new Error("User not found"));
        }
        
        if (res.status === 401) {
            // Invalid credentials
            setLoginError("Invalid email or password. Please try again.")
            setIsLoading(false)
            return Promise.reject(new Error("Invalid credentials"));
        }
        
        if (res.status === 503) {
            // Database connection issue
            setLoginError("Service temporarily unavailable. Please try again later.")
            setIsLoading(false)
            return Promise.reject(new Error("Service unavailable"));
        }
        
        if (!res.ok) {
            // Other HTTP errors
            setLoginError(`Login failed (${res.status}). Please try again.`)
            setIsLoading(false)
            return Promise.reject(new Error(`HTTP ${res.status}`));
        }
        
        // Check if response is JSON
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return res.json();
        } else {
            // Non-JSON response
            M.toast({html:"Unexpected response format. Please try again.",classes:"#f44336 red"})
            return Promise.reject(new Error("Invalid response format"));
        }
    })
    .then(data=>{
        console.log("Login response:", data)
        setIsLoading(false)
       if(data.error){
            setLoginError(data.error)
       }
       else if(data.accessToken){
           localStorage.setItem('token',data.accessToken)
           localStorage.setItem('refreshToken',data.refreshToken)
           localStorage.setItem('jwt',data.accessToken)
           localStorage.setItem('user',JSON.stringify(data.user))
           dispatch({type:"USER",payload:data.user})
           handleClose()
           // Clear form
           setEmail("")
           setPassword("")
           setLoginError("")
           history.push('/home')
       }
       else {
           setLoginError("Login failed. Please check your credentials.")
       }
    }).catch(err=>{
        console.error("Login error:", err)
        setIsLoading(false)
        // Only show generic network error for actual network issues
        if (err.message === "Failed to fetch" || err.message.includes("NetworkError")) {
            setLoginError("Network error. Please check your connection and try again.")
        }
        // For other errors, the specific message was already shown above
    })
}

const PostRegisterData=()=>{
    setRegisterError("")
    setIsLoading(true)
    
    // Validation
    if(!name || name.length < 5){
        setIsLoading(false)
        return setRegisterError("Name must be at least 5 characters long")
    }
    if(!/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)){
       setIsLoading(false)
       return setRegisterError("Please enter a valid email address")
    }
    if(!password || password.length < 5){
        setIsLoading(false)
        return setRegisterError("Password must be at least 5 characters long")
    }
    if(password !== confirmPassword){
        setIsLoading(false)
        return setRegisterError("Passwords do not match")
    }

    console.log("Sending registration data:", {name, email, password: "***"});
    
    fetch("http://localhost:5000/api/user/register",{
        method:'post',
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            name,
            password,
            email
        })
    })
    .then(res=>{
        console.log("Response status:", res.status);
        console.log("Response content-type:", res.headers.get("content-type"));
        
        // Handle different response types
        if (res.status === 409) {
            // User already exists
            M.toast({html:"This email is already registered. Please use a different email or try logging in.",classes:"#f44336 red"})
            return Promise.reject(new Error("User already exists"));
        }
        
        if (res.status === 503) {
            // Database connection issue
            M.toast({html:"Service temporarily unavailable. Please try again later.",classes:"#f44336 red"})
            return Promise.reject(new Error("Service unavailable"));
        }
        
        if (!res.ok) {
            // Other HTTP errors
            M.toast({html:`Registration failed (${res.status}). Please try again.`,classes:"#f44336 red"})
            return Promise.reject(new Error(`HTTP ${res.status}`));
        }
        
        // Check if response is JSON
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return res.json();
        } else {
            // Non-JSON response
            M.toast({html:"Unexpected response format. Please try again.",classes:"#f44336 red"})
            return Promise.reject(new Error("Invalid response format"));
        }
    })
    .then(data=>{
        console.log("Registration response:", data)
        setIsLoading(false)
       if(data.error){
            setRegisterError(data.error)
       }
       else if(data.accessToken){
           localStorage.setItem('token',data.accessToken)
           localStorage.setItem('refreshToken',data.refreshToken)
           localStorage.setItem('jwt',data.accessToken)
           localStorage.setItem('user',JSON.stringify(data.user))
           dispatch({type:"USER",payload:data.user})
           handleCloseRegister()
           // Clear form
           setName("")
           setEmail("")
           setPassword("")
           setConfirmPassword("")
           setRegisterError("")
           history.push('/home')
       }
       else {
           setRegisterError("Registration failed. Please try again.")
       }
    }).catch(err=>{
        console.error("Registration error:", err)
        setIsLoading(false)
        // Only show generic network error for actual network issues
        if (err.message === "Failed to fetch" || err.message.includes("NetworkError")) {
            setRegisterError("Network error. Please check your connection and try again.")
        }
        // For other errors, the specific message was already shown above
    })
}

  return (
    <div id="main">
      <div className="container-fluid">
        <Navbar
          fixed="top"
          variant="dark"
          expand="lg"
          className={
            navbar ? "landing-navbar active mb-5" : "landing-navbar mb-5"
          }
        >
          <Navbar.Brand href="#home" className="brand ml-md-5">
            &#8918;Portfolio Generator/&#8919;
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mr-auto">
              <Nav.Link onClick={handleShow} className="links">
                GET STARTED
              </Nav.Link>
              <Nav.Link onClick={() => history.push('/templates')} className="links">
                TEMPLATES
              </Nav.Link>
            </Nav>
            <Nav className="ml-auto mr-md-5">
              <Nav.Link onClick={() => {
                const aboutSection = document.getElementById('about-section');
                if (aboutSection) aboutSection.scrollIntoView({ behavior: 'smooth' });
              }} className="links">
                ABOUT
              </Nav.Link>
              <Nav.Link onClick={() => history.push('/about-developers')} className="links">
                DEVELOPERS
              </Nav.Link>
              <Nav.Link onClick={() => history.push('/admin')} className="links" style={{color: '#ffc107'}}>
                ADMIN
              </Nav.Link>
              <Nav.Link onClick={() => setShowRegister(true)} className="links">
                REGISTER
              </Nav.Link>
              <Nav.Link onClick={handleShow} className="links">
                LOGIN
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Navbar>

        <Modal
          show={show}
          onHide={handleClose}
          backdrop="static"
          keyboard={false}
        >
          <Modal.Header closeButton>
            <Modal.Title>Login</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {loginError && (
              <div className="alert alert-danger" role="alert">
                {loginError}
              </div>
            )}
            <Form onSubmit={(e) => {e.preventDefault(); PostData();}}>
              <Form.Group controlId="formBasicEmail" className="mb-3">
                <Form.Label>Email address</Form.Label>
                <Form.Control 
                  type="email" 
                  placeholder="Enter email"  
                  value={email}
                  onChange={(e)=>{setEmail(e.target.value); setLoginError("")}}
                  disabled={isLoading}
                  required
                />
              </Form.Group>

              <Form.Group controlId="formBasicPassword" className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e)=>{setPassword(e.target.value); setLoginError("")}}
                  disabled={isLoading}
                  required
                />
              </Form.Group>
            </Form>
            <div className="text-center mt-3">
              <a href="#" onClick={(e) => {e.preventDefault(); handleClose(); setShowRegister(true); setLoginError("");}}>Don't have an account? Sign Up</a><br />
              <a href="#" onClick={(e) => {e.preventDefault(); handleClose(); setShowPasswordReset(true); setLoginError("");}}>Forgot Password?</a>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
              Close
            </Button>
            <Button 
              variant="primary" 
              type="submit"  
              onClick={()=>PostData()}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button> 
          </Modal.Footer>
        </Modal> 

        <Modal
          show={showRegister}
          onHide={handleCloseRegister}
          backdrop="static"
          keyboard={false}
        >
          <Modal.Header closeButton>
            <Modal.Title>Register</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {registerError && (
              <div className="alert alert-danger" role="alert">
                {registerError}
              </div>
            )}
            <Form onSubmit={(e) => {e.preventDefault(); PostRegisterData();}}>
              <Form.Group controlId="formBasicName" className="mb-3">
                <Form.Label>Full Name</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Enter your name"  
                  value={name}
                  onChange={(e)=>{setName(e.target.value); setRegisterError("")}}
                  disabled={isLoading}
                  required
                />
              </Form.Group>
              <Form.Group controlId="formBasicEmail" className="mb-3">
                <Form.Label>Email address</Form.Label>
                <Form.Control 
                  type="email" 
                  placeholder="Enter email"  
                  value={email}
                  onChange={(e)=>{setEmail(e.target.value); setRegisterError("")}}
                  disabled={isLoading}
                  required
                />
              </Form.Group>

              <Form.Group controlId="formBasicPassword" className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control 
                  type="password" 
                  placeholder="Password (min 5 characters)" 
                  value={password}
                  onChange={(e)=>{setPassword(e.target.value); setRegisterError("")}}
                  disabled={isLoading}
                  required
                />
              </Form.Group>

              <Form.Group controlId="formBasicConfirmPassword" className="mb-3">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control 
                  type="password" 
                  placeholder="Confirm Password" 
                  value={confirmPassword}
                  onChange={(e)=>{setConfirmPassword(e.target.value); setRegisterError("")}}
                  disabled={isLoading}
                  required
                />
              </Form.Group>
            </Form>
            <div className="text-center mt-3">
              <a href="#" onClick={() => {handleCloseRegister(); handleShow(); setRegisterError("");}}>Already have an account? Sign In</a>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseRegister} disabled={isLoading}>
              Close
            </Button>
            <Button 
              variant="primary" 
              type="submit"  
              onClick={()=>PostRegisterData()}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Creating Account...
                </>
              ) : (
                'Register'
              )}
            </Button> 
          </Modal.Footer>
        </Modal>

        <PasswordReset 
          show={showPasswordReset} 
          handleClose={() => setShowPasswordReset(false)} 
        />

        <div className="row pt-5">
          <div className="col-12 col-md-6 p-3 p-md-5">
            <h1 className="head" style={{ 
              color: window.innerWidth < 1000 ? "black" : "white", 
              fontSize: window.innerWidth < 480 ? "4vh" : window.innerWidth < 768 ? "5vh" : "8vh",
              lineHeight: "1.2",
              marginBottom: "1rem"
            }}>
              The easy way to <br />
              build a Portfolio website
            </h1>
            <h5 className="pt-2" style={{ 
              color: window.innerWidth < 1000 ? "black" : "whitesmoke",
              fontSize: window.innerWidth < 480 ? "14px" : window.innerWidth < 768 ? "16px" : "20px",
              lineHeight: "1.4"
            }}>
              Simple tools for your big ideas. Start your free website trial
              today, with awesome templates, no credit card required.
            </h5>
            <Button onClick={() => {
              const aboutSection = document.getElementById('about-section');
              if (aboutSection) aboutSection.scrollIntoView({ behavior: 'smooth' });
            }} className="mt-3" variant="light" size={window.innerWidth < 768 ? "md" : "lg"}>
              GET STARTED
            </Button>
          </div>
          <div className="col-12 col-md-6 py-3 py-md-5 px-3 px-md-5">
            <Carousel
              activeIndex={index}
              onSelect={handleSelect}
              className="mt-3 mt-lg-5 pt-lg-5"
              style={{
                maxHeight: window.innerWidth < 768 ? "300px" : "auto",
                overflow: "hidden"
              }}
            >
              <Carousel.Item interval={300}>
                <img
                  className="d-block w-100"
                  src={images.portfolio1}
                  alt="Modern Portfolio Template"
                  style={{
                    cursor: 'pointer',
                    borderRadius: '10px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    maxHeight: window.innerWidth < 768 ? '250px' : 'auto',
                    objectFit: 'cover'
                  }}
                  onClick={() => history.push('/preview/template1')}
                />
              </Carousel.Item>
              <Carousel.Item interval={300}>
                <img
                  className="d-block w-100"
                  src={images.portfolio2}
                  alt="Creative Portfolio Template"
                  style={{
                    cursor: 'pointer',
                    borderRadius: '10px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    maxHeight: window.innerWidth < 768 ? '250px' : 'auto',
                    objectFit: 'cover'
                  }}
                  onClick={() => history.push('/preview/template2')}
                />
              </Carousel.Item>
              <Carousel.Item interval={300}>
                <img
                  className="d-block w-100"
                  src={images.portfolio3}
                  alt="Professional Portfolio Template"
                  style={{
                    cursor: 'pointer',
                    borderRadius: '10px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    maxHeight: window.innerWidth < 768 ? '250px' : 'auto',
                    objectFit: 'cover'
                  }}
                  onClick={() => history.push('/preview/template3')}
                />
              </Carousel.Item>
              <Carousel.Item interval={300}>
                <img
                  className="d-block w-100"
                  src={images.portfolio4}
                  alt="Minimalist Portfolio Template"
                  style={{
                    cursor: 'pointer',
                    borderRadius: '10px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    maxHeight: window.innerWidth < 768 ? '250px' : 'auto',
                    objectFit: 'cover'
                  }}
                  onClick={() => history.push('/preview/template4')}
                />
              </Carousel.Item>
            </Carousel>
          </div>
        </div>
      </div>
      <div className="container-fluid" id="about-section">
        <h1 className="p-5 head" data-aos="zoom-in">
          Turn your ideas <br />
          into reality.
        </h1>
        <div className="row">
          <div className="col-12 col-md-6" data-aos="zoom-in">
            <img className="img-fluid" src={images.portfolio5} />
          </div>
          <div className="col-12 col-md-6" data-aos="zoom-in">
            <div className="description mx-5 mb-5 mt-2">
              <h2 className="px-5 pt-5">
                &#8858; Choose your website template
              </h2>
              <h5 className="px-5 pb-2 d-none d-md-block">
                Select from our industry-leading website templates, and color
                pallets to best fit your personal style and professional need
              </h5>
              <h2 className="px-5">&#8858; Add your social media links</h2>
              <h5 className="px-5 pb-2 d-none d-md-block">
                Add your social media links to increase your reach and make your
                website more useful
              </h5>
              <h2 className="px-5">
                &#8858; Make awesome mobile friendly portfolio
              </h2>
              <h5 className="px-5 pb-5 d-none d-md-block">
                Easily make awesome mobile friendly portfolio website of your in
                just few steps
              </h5>
            </div>
          </div>
        </div>
      </div>
      <div className="container-fluid">
        <h1
          className="p-5 text-right"
          style={{ fontSize: "8vh" }}
          data-aos="zoom-in"
        >
          Learn how
          <br /> to get started
        </h1>
        <div className="row pb-3">
          <div
            className="col-12 col-md-6 order-1 order-md-2"
            data-aos="zoom-in"
          >
            <img className="px-5 img-fluid" src={images.portfolio6} />
          </div>
          <div
            className="col-12 col-md-6 order-2 order-md-1"
            data-aos="zoom-in"
          >
            <h5 className="px-5 py-3">
              01. Choose a template and start your free trail.
            </h5>
            <h5 className="px-5 py-3">
              02. Use our website builder to add your own text and photos.
            </h5>
            <h5 className="px-5 py-3">
              03. Costomize the site according to your need.
            </h5>
            <h5 className="px-5 py-3">
              04. Finish your work and get the domain of your site.
            </h5>
            <a className="animated px-5 py-3" href="#" onClick={(e) => {
              e.preventDefault();
              history.push('/templates');
            }}>
              Get Started
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}


export default Landing;
