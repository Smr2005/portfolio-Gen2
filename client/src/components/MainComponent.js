import React, { Component,createContext,useContext ,useEffect,useReducer} from 'react';
import {Route,useHistory,useLocation} from 'react-router-dom';
import Landing from './LandingComponent';
import Home from './HomeComponent';
import Footer from './Footer'
import Templates from '../containers/Templates';
import MyWork from '../containers/MyWork';
import Preview from '../containers/Preview';
import EnhancedBuilder from '../containers/EnhancedBuilder';
import SimpleBuilder from '../containers/SimpleBuilder';
import TestBuilder from '../containers/TestBuilder';
import WorkingBuilder from '../containers/WorkingBuilder';
import ResetPasswordPage from './ResetPasswordPage';
import PortfolioDashboard from './PortfolioDashboard';
import PortfolioViewer from './PortfolioViewer';
import AdminPanel from './AdminPanel';
import UserProfileClean from './UserProfileClean';
import AboutDevelopers from './AboutDevelopers';
import {reducer,initialState} from '../reducer/useReducer'
import { UserContext } from '../context/UserContext'

function Main (){
     const [state,dispatch]= useReducer(reducer,initialState)
     const location = useLocation();
     
     // Load user from localStorage on component mount
     useEffect(() => {
       const user = JSON.parse(localStorage.getItem("user"))
       if(user){
          dispatch({type:"USER",payload:user})
       }
     }, []);
     
     // Show footer only on landing page
     const showFooter = location.pathname === '/';
     
        return (
            <UserContext.Provider value={{state,dispatch}}>
                <Route exact path="/" component={Landing} value={{state,dispatch}}/>
                <Route exact path="/home" component={Home} />
                <Route exact path="/templates" component={Templates} />
                <Route exact path="/my-work" component={MyWork} />
                <Route exact path="/preview/:templateId" component={Preview} />
                <Route exact path="/builder" component={TestBuilder} />
                <Route exact path="/full-builder" component={WorkingBuilder} />
                <Route exact path="/dashboard" component={PortfolioDashboard} />
                <Route exact path="/portfolio/:slug" component={PortfolioViewer} />
                <Route exact path="/admin" component={AdminPanel} />
                <Route exact path="/profile" component={UserProfileClean} />
                <Route exact path="/about-developers" component={AboutDevelopers} />
                <Route exact path="/reset/:token" component={ResetPasswordPage} />
                {showFooter && <Footer />}
               </UserContext.Provider>
        );
    
}

export default Main;