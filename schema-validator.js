// Smart Business Schema Validator
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class SmartSchemaValidator {
    constructor() {
        this.ajv = new Ajv({ 
            allErrors: true,
            verbose: true,
            strict: false
        });
        addFormats(this.ajv);
        
        this.schemas = {
            // === PEOPLE & AUTHORITY ===
            Person: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Person' },
                    name: { type: 'string', minLength: 1 },
                    url: { type: 'string', format: 'uri' },
                    image: { type: 'string', format: 'uri' },
                    jobTitle: { type: 'string' },
                    worksFor: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Organization', 'MedicalOrganization'] },
                            name: { type: 'string' }
                        }
                    },
                    sameAs: {
                        type: 'array',
                        items: { type: 'string', format: 'uri' }
                    },
                    knowsAbout: {
                        type: ['string', 'array'],
                        description: 'Areas of expertise for authority'
                    },
                    hasCredential: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'EducationalOccupationalCredential' },
                            name: { type: 'string' }
                        }
                    },
                    alumniOf: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'EducationalOrganization' },
                            name: { type: 'string' }
                        }
                    }
                },
                required: ['@context', '@type', 'name'],
                recommended: ['url', 'image', 'jobTitle', 'worksFor'],
                authority: ['knowsAbout', 'hasCredential', 'alumniOf', 'sameAs'],
                additionalProperties: true
            },

            Organization: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Organization' },
                    name: { type: 'string', minLength: 1 },
                    url: { type: 'string', format: 'uri' },
                    logo: { type: 'string', format: 'uri' },
                    description: { type: 'string', minLength: 10 },
                    address: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'PostalAddress' },
                            streetAddress: { type: 'string' },
                            addressLocality: { type: 'string' },
                            addressCountry: { type: 'string' }
                        }
                    },
                    contactPoint: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'ContactPoint' },
                            telephone: { type: 'string' },
                            contactType: { type: 'string' }
                        }
                    },
                    sameAs: {
                        type: 'array',
                        items: { type: 'string', format: 'uri' }
                    },
                    foundingDate: { type: 'string', format: 'date' },
                    employee: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                '@type': { const: 'Person' }
                            }
                        }
                    }
                },
                required: ['@context', '@type', 'name'],
                recommended: ['url', 'logo', 'description', 'address'],
                additionalProperties: true
            },

            MedicalOrganization: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'MedicalOrganization' },
                    name: { type: 'string', minLength: 1 },
                    url: { type: 'string', format: 'uri' },
                    logo: { type: 'string', format: 'uri' },
                    description: { type: 'string', minLength: 10 },
                    medicalSpecialty: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    hasCredential: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'EducationalOccupationalCredential' },
                            name: { type: 'string' }
                        }
                    }
                },
                required: ['@context', '@type', 'name'],
                recommended: ['url', 'logo', 'description', 'medicalSpecialty'],
                additionalProperties: true
            },

            // === EDUCATION & CONTENT ===
            Course: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Course' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    provider: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Organization', 'EducationalOrganization'] },
                            name: { type: 'string' }
                        }
                    },
                    instructor: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Person' },
                            name: { type: 'string' }
                        }
                    },
                    courseCode: { type: 'string' },
                    educationalLevel: { type: 'string' },
                    teaches: { type: 'string' },
                    hasCourseInstance: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'CourseInstance' },
                            courseMode: { type: 'string' },
                            startDate: { type: 'string', format: 'date' },
                            endDate: { type: 'string', format: 'date' }
                        }
                    }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['provider', 'instructor', 'teaches'],
                additionalProperties: true
            },

            Article: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Article' },
                    headline: { type: 'string', minLength: 1, maxLength: 110 },
                    description: { type: 'string', minLength: 50 },
                    author: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Person' },
                            name: { type: 'string' }
                        }
                    },
                    publisher: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Organization' },
                            name: { type: 'string' },
                            logo: {
                                type: 'object',
                                properties: {
                                    '@type': { const: 'ImageObject' },
                                    url: { type: 'string', format: 'uri' }
                                }
                            }
                        }
                    },
                    datePublished: { type: 'string', format: 'date-time' },
                    dateModified: { type: 'string', format: 'date-time' },
                    image: { type: 'string', format: 'uri' },
                    url: { type: 'string', format: 'uri' },
                    about: { type: 'string' },
                    keywords: { type: 'string' }
                },
                required: ['@context', '@type', 'headline', 'author', 'datePublished', 'publisher'],
                recommended: ['image', 'dateModified', 'url', 'description'],
                additionalProperties: true
            },

            PodcastEpisode: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'PodcastEpisode' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    url: { type: 'string', format: 'uri' },
                    audio: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'AudioObject' },
                            contentUrl: { type: 'string', format: 'uri' }
                        }
                    },
                    partOfSeries: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'PodcastSeries' },
                            name: { type: 'string' }
                        }
                    },
                    datePublished: { type: 'string', format: 'date-time' },
                    duration: { type: 'string' }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['url', 'audio', 'partOfSeries', 'datePublished'],
                additionalProperties: true
            },

            // === EVENTS & SERVICES ===
            Event: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Event' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    startDate: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time' },
                    location: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Place', 'VirtualLocation'] },
                            name: { type: 'string' },
                            address: { type: 'string' }
                        }
                    },
                    organizer: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Person', 'Organization'] },
                            name: { type: 'string' }
                        }
                    },
                    offers: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Offer' },
                            price: { type: ['string', 'number'] },
                            priceCurrency: { type: 'string' },
                            availability: { type: 'string' }
                        }
                    },
                    image: { type: 'string', format: 'uri' },
                    url: { type: 'string', format: 'uri' }
                },
                required: ['@context', '@type', 'name', 'startDate'],
                recommended: ['description', 'location', 'organizer', 'endDate'],
                additionalProperties: true
            },

            Service: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Service' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    provider: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Person', 'Organization'] },
                            name: { type: 'string' }
                        }
                    },
                    serviceType: { type: 'string' },
                    areaServed: { type: 'string' },
                    offers: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Offer' },
                            price: { type: ['string', 'number'] },
                            priceCurrency: { type: 'string' }
                        }
                    }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['provider', 'serviceType', 'areaServed'],
                additionalProperties: true
            },

            // === LOCAL BUSINESS ===
            LocalBusiness: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'LocalBusiness' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    address: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'PostalAddress' },
                            streetAddress: { type: 'string' },
                            addressLocality: { type: 'string' },
                            addressCountry: { type: 'string' }
                        },
                        required: ['@type', 'addressLocality']
                    },
                    telephone: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    image: { type: 'string', format: 'uri' },
                    openingHours: { type: 'string' },
                    priceRange: { type: 'string' },
                    aggregateRating: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'AggregateRating' },
                            ratingValue: { type: 'number', minimum: 0, maximum: 5 },
                            reviewCount: { type: 'number', minimum: 1 }
                        }
                    }
                },
                required: ['@context', '@type', 'name', 'address'],
                recommended: ['description', 'telephone', 'url', 'openingHours'],
                additionalProperties: true
            },

            FoodEstablishment: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'FoodEstablishment' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    address: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'PostalAddress' },
                            streetAddress: { type: 'string' },
                            addressLocality: { type: 'string' },
                            addressCountry: { type: 'string' }
                        }
                    },
                    servesCuisine: { type: 'string' },
                    hasMenu: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Menu' },
                            url: { type: 'string', format: 'uri' }
                        }
                    },
                    telephone: { type: 'string' },
                    priceRange: { type: 'string' }
                },
                required: ['@context', '@type', 'name'],
                recommended: ['description', 'address', 'servesCuisine', 'telephone'],
                additionalProperties: true
            },

            // === MEDICAL & PRODUCTS ===
            MedicalDevice: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'MedicalDevice' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    manufacturer: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Organization', 'MedicalOrganization'] },
                            name: { type: 'string' }
                        }
                    },
                    deviceCategory: { type: 'string' },
                    indication: { type: 'string' },
                    contraindication: { type: 'string' },
                    guideline: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'MedicalGuideline' },
                            name: { type: 'string' }
                        }
                    }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['manufacturer', 'deviceCategory', 'indication'],
                additionalProperties: true
            },

            Product: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Product' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    image: { type: 'string', format: 'uri' },
                    brand: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Brand' },
                            name: { type: 'string' }
                        }
                    },
                    manufacturer: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Organization' },
                            name: { type: 'string' }
                        }
                    },
                    offers: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Offer' },
                            price: { type: ['string', 'number'] },
                            priceCurrency: { type: 'string', pattern: '^[A-Z]{3}$' },
                            availability: { type: 'string', format: 'uri' }
                        }
                    },
                    aggregateRating: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'AggregateRating' },
                            ratingValue: { type: 'number', minimum: 0, maximum: 5 },
                            reviewCount: { type: 'number', minimum: 1 }
                        }
                    }
                },
                required: ['@context', '@type', 'name'],
                recommended: ['description', 'image', 'brand', 'offers'],
                additionalProperties: true
            }
        };
    }
    
    validateSchema(data) {
        const schemaType = data['@type'];
        
        if (!schemaType) {
            return {
                valid: false,
                errors: ['Missing @type property'],
                warnings: [],
                recommendations: ['Add @type property to specify schema type'],
                score: 0
            };
        }
        
        const schemaDefinition = this.schemas[schemaType];
        
        if (!schemaDefinition) {
            return this.basicValidation(data, schemaType);
        }
        
        // Full validation for supported schemas
        const validate = this.ajv.compile(schemaDefinition);
        const isValid = validate(data);
        
        const result = {
            valid: isValid,
            errors: this.formatErrors(validate.errors || []),
            warnings: [],
            recommendations: [],
            score: 0,
            completeness: 0,
            authorityScore: 0
        };
        
        // Check missing recommended fields
        const missingRecommended = this.checkMissing(data, schemaDefinition.recommended || []);
        if (missingRecommended.length > 0) {
            result.warnings.push(`Missing recommended: ${missingRecommended.join(', ')}`);
        }
        
        // Check authority fields (for Person/Organization)
        if (schemaDefinition.authority) {
            const missingAuthority = this.checkMissing(data, schemaDefinition.authority);
            result.authorityScore = this.calculateAuthorityScore(data, schemaDefinition.authority);
            if (missingAuthority.length > 0) {
                result.recommendations.push(`For better authority: add ${missingAuthority.join(', ')}`);
            }
        }
        
        // Calculate scores
        result.score = this.calculateScore(data, schemaDefinition, result.errors.length);
        result.completeness = this.calculateCompleteness(data, schemaDefinition);
        
        // Add specific recommendations
        result.recommendations.push(...this.getBusinessRecommendations(schemaType, data));
        
        return result;
    }
    
    basicValidation(data, schemaType) {
        const errors = [];
        const warnings = [];
        const recommendations = [];
        
        // Basic checks for any schema
        if (!data['@context']) {
            errors.push('Missing @context property');
        } else if (data['@context'] !== 'https://schema.org') {
            warnings.push('Non-standard @context value');
        }
        
        if (!data.name && !data.headline) {
            errors.push('Missing name or headline');
        }
        
        // Check URLs
        ['url', 'image', 'logo'].forEach(field => {
            if (data[field] && !this.isValidUrl(data[field])) {
                errors.push(`Invalid ${field} format`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors,
            warnings: [...warnings, `Schema '${schemaType}' - basic validation only`],
            recommendations: [...recommendations, 'Consider using supported schema types for detailed validation'],
            score: errors.length === 0 ? 70 : 30,
            completeness: 50,
            basicValidation: true
        };
    }
    
    formatErrors(errors) {
        return errors.map(error => {
            const path = error.instancePath || 'root';
            return `${path}: ${error.message}`;
        });
    }
    
    checkMissing(data, fields) {
        return fields.filter(field => !(field in data) || !data[field]);
    }
    
    calculateScore(data, schema, errorCount) {
        let score = 100;
        score -= errorCount * 15; // Major penalty for errors
        score -= this.checkMissing(data, schema.recommended || []).length * 5;
        score += this.getBonusPoints(data);
        return Math.max(0, Math.min(100, score));
    }
    
    calculateCompleteness(data, schema) {
        const allFields = Object.keys(schema.properties);
        const presentFields = Object.keys(data).filter(key => 
            allFields.includes(key) && data[key] !== null && data[key] !== ''
        );
        return Math.round((presentFields.length / allFields.length) * 100);
    }
    
    calculateAuthorityScore(data, authorityFields) {
        const presentAuthority = authorityFields.filter(field => data[field]);
        return Math.round((presentAuthority.length / authorityFields.length) * 100);
    }
    
    getBonusPoints(data) {
        let bonus = 0;
        if (data.sameAs && Array.isArray(data.sameAs)) bonus += 5;
        if (data.image || data.logo) bonus += 3;
        if (data.description && data.description.length > 100) bonus += 3;
        return bonus;
    }
    
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    getBusinessRecommendations(schemaType, data) {
        const recs = [];
        
        switch (schemaType) {
            case 'Person':
                if (!data.knowsAbout) recs.push('Add knowsAbout for expertise authority');
                if (!data.hasCredential) recs.push('Add professional credentials');
                if (!data.sameAs) recs.push('Add LinkedIn and social profiles');
                break;
                
            case 'Course':
                if (!data.instructor) recs.push('Add instructor information for credibility');
                if (!data.hasCourseInstance) recs.push('Add course schedule/instance details');
                break;
                
            case 'MedicalDevice':
                if (!data.indication) recs.push('Add medical indications for compliance');
                if (!data.manufacturer) recs.push('Add manufacturer information');
                break;
                
            case 'LocalBusiness':
                if (!data.openingHours) recs.push('Add opening hours for local SEO');
                if (!data.aggregateRating) recs.push('Add customer reviews/ratings');
                break;
                
            case 'Event':
                if (!data.offers) recs.push('Add pricing information');
                if (!data.image) recs.push('Add event image for social sharing');
                break;
        }
        
        return recs;
    }
}

module.exports = SmartSchemaValidator;
