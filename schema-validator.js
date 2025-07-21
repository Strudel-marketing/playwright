// Smart Business Schema Validator - Enhanced Version
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
            // === WEBSITE & TECHNICAL ===
            WebSite: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'WebSite' },
                    name: { type: 'string', minLength: 1 },
                    url: { type: 'string', format: 'uri' },
                    description: { type: 'string', minLength: 10 },
                    potentialAction: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'SearchAction' },
                            target: { type: 'string' },
                            'query-input': { type: 'string' }
                        }
                    },
                    publisher: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Organization', 'Person'] },
                            name: { type: 'string' }
                        }
                    },
                    inLanguage: { type: 'string' },
                    keywords: { type: 'string' }
                },
                required: ['@context', '@type', 'name', 'url'],
                recommended: ['description', 'potentialAction', 'publisher'],
                additionalProperties: true
            },

            WebPage: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'WebPage' },
                    name: { type: 'string', minLength: 1 },
                    url: { type: 'string', format: 'uri' },
                    description: { type: 'string', minLength: 10 },
                    isPartOf: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'WebSite' },
                            name: { type: 'string' }
                        }
                    },
                    breadcrumb: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'BreadcrumbList' }
                        }
                    },
                    mainEntity: { type: 'object' },
                    primaryImageOfPage: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'ImageObject' },
                            url: { type: 'string', format: 'uri' }
                        }
                    },
                    datePublished: { type: 'string', format: 'date-time' },
                    dateModified: { type: 'string', format: 'date-time' }
                },
                required: ['@context', '@type'],
                recommended: ['name', 'url', 'description', 'isPartOf'],
                additionalProperties: true
            },

            BreadcrumbList: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'BreadcrumbList' },
                    itemListElement: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            properties: {
                                '@type': { const: 'ListItem' },
                                position: { type: 'integer', minimum: 1 },
                                name: { type: 'string', minLength: 1 },
                                item: { type: 'string', format: 'uri' }
                            },
                            required: ['@type', 'position', 'name']
                        }
                    }
                },
                required: ['@context', '@type', 'itemListElement'],
                recommended: [],
                additionalProperties: true
            },

            ListItem: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'ListItem' },
                    position: { type: 'integer', minimum: 1 },
                    name: { type: 'string', minLength: 1 },
                    item: { type: 'string', format: 'uri' },
                    url: { type: 'string', format: 'uri' }
                },
                required: ['@context', '@type', 'position'],
                recommended: ['name', 'item'],
                additionalProperties: true
            },

            ImageObject: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'ImageObject' },
                    url: { type: 'string', format: 'uri' },
                    width: { type: 'integer', minimum: 1 },
                    height: { type: 'integer', minimum: 1 },
                    caption: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    contentUrl: { type: 'string', format: 'uri' },
                    thumbnailUrl: { type: 'string', format: 'uri' }
                },
                required: ['@context', '@type', 'url'],
                recommended: ['width', 'height', 'caption'],
                additionalProperties: true
            },

            SearchAction: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'SearchAction' },
                    target: { 
                        type: ['string', 'object'],
                        description: 'URL template or EntryPoint object'
                    },
                    'query-input': { 
                        type: 'string',
                        pattern: 'required name=.+',
                        description: 'Must specify required name parameter'
                    }
                },
                required: ['@context', '@type', 'target', 'query-input'],
                recommended: [],
                additionalProperties: true
            },

            ReadAction: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'ReadAction' },
                    target: { type: 'string', format: 'uri' },
                    object: { type: 'object' },
                    agent: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Person', 'Organization'] },
                            name: { type: 'string' }
                        }
                    }
                },
                required: ['@context', '@type'],
                recommended: ['target', 'object'],
                additionalProperties: true
            },

            EntryPoint: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'EntryPoint' },
                    urlTemplate: { type: 'string' },
                    actionPlatform: { 
                        type: 'array',
                        items: { type: 'string', format: 'uri' }
                    }
                },
                required: ['@context', '@type'],
                recommended: ['urlTemplate'],
                additionalProperties: true
            },

            PropertyValueSpecification: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'PropertyValueSpecification' },
                    valueName: { type: 'string' },
                    valueRequired: { type: 'boolean' },
                    defaultValue: { type: ['string', 'number', 'boolean'] },
                    valuePattern: { type: 'string' }
                },
                required: ['@context', '@type'],
                recommended: ['valueName'],
                additionalProperties: true
            },

            // === EXISTING SCHEMAS (keeping all your current ones) ===
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

            // === BUSINESS SERVICES & CONSULTING ===
            ProfessionalService: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'ProfessionalService' },
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
                    hasOfferCatalog: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'OfferCatalog' },
                            name: { type: 'string' }
                        }
                    },
                    offers: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Offer' },
                            price: { type: ['string', 'number'] },
                            priceCurrency: { type: 'string' }
                        }
                    },
                    aggregateRating: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'AggregateRating' },
                            ratingValue: { type: 'number' },
                            reviewCount: { type: 'number' }
                        }
                    }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['provider', 'serviceType', 'areaServed', 'offers'],
                additionalProperties: true
            },

            BusinessConsultant: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'BusinessConsultant' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    provider: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Person' },
                            name: { type: 'string' },
                            knowsAbout: { type: 'array' },
                            hasCredential: { type: 'object' }
                        }
                    },
                    serviceType: { 
                        type: 'string',
                        enum: ['Business Automation', 'Marketing Consulting', 'Digital Strategy', 'Process Optimization']
                    },
                    expertise: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    clientIndustry: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    methodology: { type: 'string' },
                    serviceOutput: { type: 'string' }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['provider', 'serviceType', 'expertise', 'clientIndustry'],
                authority: ['provider.knowsAbout', 'provider.hasCredential', 'expertise', 'methodology'],
                additionalProperties: true
            },

            AutomationService: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'AutomationService' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    serviceType: { 
                        type: 'string',
                        enum: ['Business Process Automation', 'Marketing Automation', 'Sales Automation', 'Customer Service Automation']
                    },
                    automationPlatform: {
                        type: 'array',
                        items: { 
                            type: 'string',
                            enum: ['Make.com', 'Zapier', 'n8n', 'Microsoft Power Automate', 'Custom Development']
                        }
                    },
                    processesAutomated: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    targetIndustry: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    expectedOutcome: { type: 'string' },
                    implementationTime: { type: 'string' }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['serviceType', 'automationPlatform', 'processesAutomated', 'expectedOutcome'],
                additionalProperties: true
            },

            CateringService: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'CateringService' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    provider: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'FoodEstablishment' },
                            name: { type: 'string' }
                        }
                    },
                    servesCuisine: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    serviceType: {
                        type: 'array',
                        items: { 
                            type: 'string',
                            enum: ['Corporate Events', 'Weddings', 'Private Parties', 'Conferences', 'Kosher Catering', 'Vegan Catering']
                        }
                    },
                    areaServed: { type: 'string' },
                    minimumAttendeeCapacity: { type: 'number' },
                    maximumAttendeeCapacity: { type: 'number' },
                    hasMenu: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Menu' },
                            url: { type: 'string', format: 'uri' }
                        }
                    },
                    offers: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Offer' },
                            priceRange: { type: 'string' },
                            priceCurrency: { type: 'string' }
                        }
                    }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['servesCuisine', 'serviceType', 'areaServed', 'hasMenu'],
                additionalProperties: true
            },

            SolarInstallationService: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'SolarInstallationService' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    provider: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Organization' },
                            name: { type: 'string' },
                            hasCredential: { type: 'object' }
                        }
                    },
                    serviceType: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['Residential Solar', 'Commercial Solar', 'Industrial Solar', 'Solar Consultation', 'Solar Maintenance']
                        }
                    },
                    systemCapacity: { type: 'string' },
                    warrantyPeriod: { type: 'string' },
                    installationArea: { type: 'string' },
                    energySavings: { type: 'string' },
                    paybackPeriod: { type: 'string' },
                    certification: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    environmentalBenefit: { type: 'string' }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['serviceType', 'systemCapacity', 'warrantyPeriod', 'energySavings'],
                authority: ['provider.hasCredential', 'certification', 'warrantyPeriod'],
                additionalProperties: true
            },

            // === ENHANCED EDUCATION & CONTENT ===
            EducationalCourse: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'EducationalCourse' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    provider: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['EducationalOrganization', 'Person'] },
                            name: { type: 'string' }
                        }
                    },
                    instructor: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Person' },
                            name: { type: 'string' },
                            hasCredential: { type: 'object' },
                            knowsAbout: { type: 'array' }
                        }
                    },
                    courseCode: { type: 'string' },
                    educationalLevel: { 
                        type: 'string',
                        enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional']
                    },
                    teaches: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    coursePrerequisites: { type: 'string' },
                    timeRequired: { type: 'string' },
                    courseMode: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['Online', 'In-Person', 'Hybrid', 'Self-Paced']
                        }
                    },
                    hasCourseInstance: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'CourseInstance' },
                            courseMode: { type: 'string' },
                            startDate: { type: 'string', format: 'date' },
                            endDate: { type: 'string', format: 'date' },
                            location: { type: 'object' }
                        }
                    },
                    learningOutcome: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    certification: { type: 'string' },
                    targetAudience: { type: 'string' }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['provider', 'instructor', 'teaches', 'educationalLevel', 'courseMode'],
                authority: ['instructor.hasCredential', 'instructor.knowsAbout', 'certification'],
                additionalProperties: true
            },

            // === ENHANCED PODCAST SCHEMAS ===
            PodcastSeries: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'PodcastSeries' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string', minLength: 10 },
                    url: { type: 'string', format: 'uri' },
                    creator: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['Person', 'Organization'] },
                            name: { type: 'string' }
                        }
                    },
                    host: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Person' },
                            name: { type: 'string' },
                            knowsAbout: { type: 'array' }
                        }
                    },
                    genre: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    inLanguage: { type: 'string' },
                    dateCreated: { type: 'string', format: 'date' },
                    numberOfEpisodes: { type: 'number' },
                    webFeed: { type: 'string', format: 'uri' },
                    image: { type: 'string', format: 'uri' },
                    keywords: { type: 'string' },
                    targetAudience: { type: 'string' },
                    publishingFrequency: { type: 'string' }
                },
                required: ['@context', '@type', 'name', 'description'],
                recommended: ['creator', 'host', 'genre', 'webFeed', 'image'],
                authority: ['host.knowsAbout', 'numberOfEpisodes', 'publishingFrequency'],
                additionalProperties: true
            },

            // === ENHANCED PERSON SCHEMA FOR EXPERTS ===
            ExpertPerson: {
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
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Areas of expertise for authority'
                    },
                    hasCredential: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                '@type': { const: 'EducationalOccupationalCredential' },
                                name: { type: 'string' },
                                credentialCategory: { type: 'string' },
                                recognizedBy: { type: 'object' }
                            }
                        }
                    },
                    alumniOf: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                '@type': { const: 'EducationalOrganization' },
                                name: { type: 'string' }
                            }
                        }
                    },
                    award: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    memberOf: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                '@type': { const: 'Organization' },
                                name: { type: 'string' }
                            }
                        }
                    },
                    hasOccupation: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Occupation' },
                            name: { type: 'string' },
                            occupationLocation: { type: 'object' }
                        }
                    },
                    experienceYears: { type: 'number' },
                    expertise: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    publications: {
                        type: 'array',
                        items: { type: 'object' }
                    }
                },
                required: ['@context', '@type', 'name'],
                recommended: ['url', 'image', 'jobTitle', 'worksFor', 'knowsAbout'],
                authority: ['knowsAbout', 'hasCredential', 'alumniOf', 'sameAs', 'award', 'memberOf', 'experienceYears', 'publications'],
                additionalProperties: true
            },

            // === REVIEW & TESTIMONIAL SCHEMAS ===
            Review: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Review' },
                    reviewBody: { type: 'string', minLength: 10 },
                    reviewRating: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Rating' },
                            ratingValue: { type: 'number', minimum: 1, maximum: 5 },
                            bestRating: { type: 'number', const: 5 },
                            worstRating: { type: 'number', const: 1 }
                        },
                        required: ['@type', 'ratingValue']
                    },
                    author: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Person' },
                            name: { type: 'string' }
                        }
                    },
                    itemReviewed: {
                        type: 'object',
                        properties: {
                            '@type': { type: 'string' },
                            name: { type: 'string' }
                        }
                    },
                    datePublished: { type: 'string', format: 'date' },
                    publisher: {
                        type: 'object',
                        properties: {
                            '@type': { const: 'Organization' },
                            name: { type: 'string' }
                        }
                    }
                },
                required: ['@context', '@type', 'reviewBody', 'reviewRating', 'author'],
                recommended: ['itemReviewed', 'datePublished'],
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
                
            case 'WebSite':
                if (!data.potentialAction) recs.push('Add SearchAction for site search functionality');
                if (!data.publisher) recs.push('Add publisher information for credibility');
                if (!data.inLanguage) recs.push('Specify website language');
                break;
                
            case 'WebPage':
                if (!data.isPartOf) recs.push('Link to parent WebSite schema');
                if (!data.breadcrumb) recs.push('Add breadcrumb navigation');
                if (!data.primaryImageOfPage) recs.push('Add main page image');
                break;
                
            case 'BreadcrumbList':
                if (data.itemListElement && data.itemListElement.length < 2) {
                    recs.push('Breadcrumb should have at least 2 items for navigation value');
                }
                break;
                
            case 'ImageObject':
                if (!data.width || !data.height) recs.push('Add width/height for better image optimization');
                if (!data.caption) recs.push('Add image caption for accessibility');
                break;
                
            case 'Organization':
                if (!data.address) recs.push('Add address for local SEO benefits');
                if (!data.contactPoint) recs.push('Add contact information');
                if (!data.sameAs) recs.push('Add social media profiles');
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
                
            case 'ProfessionalService':
                if (!data.serviceType) recs.push('Specify service type for better categorization');
                if (!data.areaServed) recs.push('Add service area for local SEO');
                if (!data.aggregateRating) recs.push('Add client reviews and ratings');
                break;
                
            case 'BusinessConsultant':
                if (!data.expertise) recs.push('List areas of expertise for authority');
                if (!data.clientIndustry) recs.push('Specify target industries');
                if (!data.methodology) recs.push('Describe consulting methodology');
                break;
                
            case 'AutomationService':
                if (!data.automationPlatform) recs.push('Specify automation tools/platforms used');
                if (!data.processesAutomated) recs.push('List specific processes that can be automated');
                if (!data.expectedOutcome) recs.push('Describe expected business outcomes');
                break;
                
            case 'CateringService':
                if (!data.servesCuisine) recs.push('Specify cuisine types for better discovery');
                if (!data.hasMenu) recs.push('Add menu link for customer reference');
                if (!data.minimumAttendeeCapacity) recs.push('Add capacity information');
                break;
                
            case 'SolarInstallationService':
                if (!data.certification) recs.push('Add industry certifications for trust');
                if (!data.warrantyPeriod) recs.push('Specify warranty terms');
                if (!data.energySavings) recs.push('Highlight energy savings benefits');
                break;
                
            case 'EducationalCourse':
                if (!data.learningOutcome) recs.push('Define clear learning outcomes');
                if (!data.targetAudience) recs.push('Specify target audience');
                if (!data.certification) recs.push('Add certification information if applicable');
                break;
                
            case 'PodcastSeries':
                if (!data.webFeed) recs.push('Add RSS feed URL for podcast platforms');
                if (!data.publishingFrequency) recs.push('Specify publishing schedule');
                if (!data.targetAudience) recs.push('Define target audience');
                break;
                
            case 'ExpertPerson':
                if (!data.experienceYears) recs.push('Add years of experience for credibility');
                if (!data.award) recs.push('List professional awards and recognition');
                if (!data.publications) recs.push('Add publications or notable work');
                break;
                
            case 'Review':
                if (!data.datePublished) recs.push('Add review date for freshness');
                if (!data.publisher) recs.push('Add review platform/publisher info');
                break;
        }
        
        return recs;
    }

    // Enhanced validateAll method for comprehensive validation
    validateAll(schemas) {
        if (!Array.isArray(schemas)) {
            return {
                success: false,
                result: {
                    overallScore: 0,
                    schemasFound: 0,
                    schemas: [],
                    summary: {
                        totalSchemas: 0,
                        validSchemas: 0,
                        errorsFound: 1,
                        warningsFound: 0
                    },
                    generalRecommendations: ['Invalid input: expected array of schemas']
                }
            };
        }

        if (schemas.length === 0) {
            return {
                success: true,
                result: {
                    url: 'N/A',
                    timestamp: new Date().toISOString(),
                    overallScore: 0,
                    schemasFound: 0,
                    schemas: [],
                    summary: {
                        totalSchemas: 0,
                        validSchemas: 0,
                        errorsFound: 0,
                        warningsFound: 0
                    },
                    generalRecommendations: [
                        'No structured data found.',
                        'Consider adding Schema.org markup for better SEO.',
                        'Start with basic schemas like Organization, WebSite, or WebPage.'
                    ]
                }
            };
        }

        const results = [];
        let totalScore = 0;
        let totalCompleteness = 0;
        let totalAuthority = 0;
        let validCount = 0;
        let errorCount = 0;
        let warningCount = 0;
        let authoritySchemas = 0;

        schemas.forEach((schema, index) => {
            const validation = this.validateSchema(schema);
            
            const result = {
                index,
                type: schema['@type'] || 'unknown',
                valid: validation.valid,
                score: validation.score,
                completeness: validation.completeness || 0,
                authorityScore: validation.authorityScore || 0,
                errors: validation.errors,
                warnings: validation.warnings,
                recommendations: validation.recommendations,
                basicValidation: validation.basicValidation || false
            };
            
            results.push(result);

            totalScore += validation.score;
            totalCompleteness += (validation.completeness || 0);
            if (validation.authorityScore !== undefined) {
                totalAuthority += validation.authorityScore;
                authoritySchemas++;
            }
            
            if (validation.valid) validCount++;
            errorCount += validation.errors.length;
            warningCount += validation.warnings.length;
        });

        const overallScore = Math.round(totalScore / schemas.length);
        const overallCompleteness = Math.round(totalCompleteness / schemas.length);
        const overallAuthority = authoritySchemas > 0 ? Math.round(totalAuthority / authoritySchemas) : 0;
        
        const generalRecommendations = [];
        
        // Schema coverage analysis
        const schemaTypes = [...new Set(results.map(r => r.type))];
        generalRecommendations.push(`Found ${schemas.length} schema(s) of ${schemaTypes.length} different types`);
        
        // Quality assessment
        if (validCount === schemas.length) {
            generalRecommendations.push('🎉 All schemas are valid! Excellent structured data implementation');
        } else if (validCount > schemas.length / 2) {
            generalRecommendations.push(`✅ ${validCount}/${schemas.length} schemas are valid. Good progress!`);
        } else {
            generalRecommendations.push(`⚠️ ${validCount}/${schemas.length} schemas are valid. Review errors and warnings`);
        }

        // Score-based feedback
        if (overallScore >= 90) {
            generalRecommendations.push('🚀 Outstanding structured data quality!');
        } else if (overallScore >= 80) {
            generalRecommendations.push('🌟 High-quality structured data implementation');
        } else if (overallScore >= 60) {
            generalRecommendations.push('👍 Good structured data foundation');
        } else {
            generalRecommendations.push('📈 Consider improving structured data quality');
        }

        // Authority assessment
        if (authoritySchemas > 0) {
            if (overallAuthority >= 80) {
                generalRecommendations.push('💪 Strong authority signals detected');
            } else if (overallAuthority >= 50) {
                generalRecommendations.push('📊 Moderate authority signals - consider enhancing');
            } else {
                generalRecommendations.push('🔍 Low authority signals - add credentials and expertise markers');
            }
        }

        // Technical recommendations
        const basicValidationCount = results.filter(r => r.basicValidation).length;
        if (basicValidationCount > 0) {
            generalRecommendations.push(`${basicValidationCount} schema(s) received basic validation only - consider using supported schema types`);
        }

        return {
            success: true,
            result: {
                url: 'N/A',
                timestamp: new Date().toISOString(),
                overallScore,
                overallCompleteness,
                overallAuthority,
                schemasFound: schemas.length,
                schemas: results,
                summary: {
                    totalSchemas: schemas.length,
                    validSchemas: validCount,
                    errorsFound: errorCount,
                    warningsFound: warningCount,
                    schemaTypes: schemaTypes.length,
                    supportedSchemas: schemas.length - basicValidationCount,
                    basicValidationSchemas: basicValidationCount
                },
                generalRecommendations
            }
        };
    }
}

module.exports = SmartSchemaValidator;
