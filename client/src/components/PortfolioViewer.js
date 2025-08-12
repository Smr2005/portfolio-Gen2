import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Template1 from '../templates/Template1';
import Template2 from '../templates/Template2';
import Template3 from '../templates/Template3';
import Template4 from '../templates/Template4';
import Template5 from '../templates/Template5';
import Template6 from '../templates/Template6';

const PortfolioViewer = () => {
    const { slug } = useParams();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`/api/portfolio/${slug}`);
                setPortfolio(response.data);
                setError(null);
            } catch (err) {
                console.error('Error fetching portfolio:', err);
                setError(err.response?.status === 404 ? 'Portfolio not found' : 'Error loading portfolio');
            } finally {
                setLoading(false);
            }
        };

        if (slug) {
            fetchPortfolio();
        }
    }, [slug]);

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                        width: '50px', 
                        height: '50px', 
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTop: '3px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }}></div>
                    <h3>Loading Portfolio...</h3>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textAlign: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>😔</h1>
                    <h2>{error}</h2>
                    <p>The portfolio you're looking for doesn't exist or is not published.</p>
                    <a 
                        href="/" 
                        style={{ 
                            color: 'white', 
                            textDecoration: 'underline',
                            fontSize: '1.1rem'
                        }}
                    >
                        Create Your Own Portfolio
                    </a>
                </div>
            </div>
        );
    }

    if (!portfolio) {
        return null;
    }

    // Render the appropriate template
    const renderTemplate = () => {
        const { data, templateId } = portfolio;
        
        switch (templateId) {
            case 'template1':
                return <Template1 userData={data} isPreview={false} />;
            case 'template2':
                return <Template2 userData={data} isPreview={false} />;
            case 'template3':
                return <Template3 userData={data} isPreview={false} />;
            case 'template4':
                return <Template4 userData={data} isPreview={false} />;
            case 'template5':
                return <Template5 userData={data} isPreview={false} />;
            case 'template6':
                return <Template6 userData={data} isPreview={false} />;
            default:
                return <Template1 userData={data} isPreview={false} />;
        }
    };

    return (
        <div>
            {renderTemplate()}
        </div>
    );
};

export default PortfolioViewer;