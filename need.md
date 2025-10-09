AI Health Assistant
Overview
This is a multilingual AI health assistant application designed to serve rural and semi-urban communities in Odisha, India. The system provides health information, symptom checking, facility finding, and emergency services through an accessible web interface. It supports multiple local languages (English, Hindi, Odia, Bengali, Telugu, Tamil) and features voice input capabilities for better accessibility. The application integrates with Twilio for SMS and WhatsApp communication channels, enabling health alerts and remote consultations.

User Preferences
Preferred communication style: Simple, everyday language.

System Architecture
Frontend Architecture
The frontend is built with React and TypeScript, using Vite as the build tool. Key architectural decisions include:

Component Structure: Uses a modular component approach with shadcn/ui for consistent UI components
State Management: React Query for server state management and local React state for UI state
Routing: Wouter for lightweight client-side routing
Styling: Tailwind CSS with CSS custom properties for theming
Voice Integration: Native Web Speech API for voice input and text-to-speech functionality
Offline Support: Custom hooks for detecting network status and localStorage caching
Backend Architecture
The backend follows an Express.js REST API architecture with the following patterns:

Server Framework: Express.js with TypeScript for type safety
Database Layer: Drizzle ORM with PostgreSQL for data persistence
Storage Abstraction: Interface-based storage layer supporting both in-memory and database implementations
Service Layer: Separate services for health data, OpenAI integration, and Twilio communication
Request Handling: Middleware-based request processing with error handling
Database Design
The system uses PostgreSQL with the following key entities:

Users: Phone number-based authentication with language preferences
Health Categories: Hierarchical health information organization (diseases, symptoms, facilities, etc.)
Health Entries: Multilingual health content with risk assessments and recommendations
Health Alerts: Broadcast notifications with priority levels and expiration
Chat Messages: Conversation history for AI interactions
Health Facilities: Geolocation-enabled facility directory
Multilingual Support
Language handling is implemented through:

Translation Storage: JSONB fields for storing translations in multiple languages
Language Detection: Browser-based language detection with user preference override
Voice Language Mapping: Language-specific voice recognition and synthesis
Content Fallback: English as fallback language when translations are unavailable
AI Integration
The system integrates with OpenAI for health analysis:

Query Processing: Natural language understanding for health queries
Risk Assessment: AI-powered risk level determination (LOW/MEDIUM/HIGH/CRITICAL)
Recommendation Generation: Context-aware health recommendations
Multi-language Response: Language-specific response generation
External Dependencies
Core Infrastructure
Neon Database: PostgreSQL database hosting with connection pooling
Drizzle Kit: Database migrations and schema management
Vite: Frontend build tool with development server
AI and Communication Services
OpenAI API: GPT model integration for health query analysis and response generation
Twilio: SMS and WhatsApp messaging for alerts and remote communication
Web Speech API: Browser-based voice recognition and synthesis
UI and Frontend Libraries
Radix UI: Accessible component primitives for form controls, dialogs, and navigation
Tailwind CSS: Utility-first CSS framework for consistent styling
React Query: Server state management and caching
Wouter: Lightweight routing library
Development and Build Tools
TypeScript: Type safety across frontend and backend
ESBuild: Fast JavaScript bundling for production builds
PostCSS: CSS processing with Autoprefixer for browser compatibility
tsx: TypeScript execution for development server
Optional Integrations
Font Awesome: Icon library for UI elements
Google Fonts: Web fonts (Inter, Open Sans) for typography
Replit Cartographer: Development environment integration (development mode only)