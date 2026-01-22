<h1>Smart Vehicle Health Monitoring System (SVHMS)</h1>

<h2>Introduction</h2>
<p>
The <strong>Smart Vehicle Health Monitoring System (SVHMS)</strong> is a backend platform designed to intelligently monitor and analyze vehicle health. 
It uses a modular architecture to separate concerns into different services, including <strong>users</strong>, <strong>vehicles</strong>, <strong>OBD</strong>, and <strong>diagnostics</strong>, which communicate through an <strong>event bus</strong> to maintain service boundaries.
</p>

<h2>System Workflow</h2>
<ol>
  <li><strong>User Registration:</strong> Users create an account and log in to the system.</li>
  <li><strong>Vehicle Registration:</strong> Users register their vehicles within the platform.</li>
  <li><strong>OBD Data Integration:</strong> When the vehicle is connected to the OBD module, it sends real-time OBD-II readings to the backend endpoints.</li>
  <li><strong>Rule Engine Processing:</strong> The backend computes a <em>confidence score</em> for potential failures based on the OBD readings.</li>
  <li><strong>AI Analysis:</strong> The confidence score is fed to an AI model (Groq/Compound) to predict which vehicle parts are at risk of failure.</li>
  <li><strong>Diagnostics Storage:</strong> The computed diagnostics and AI analysis are saved in the database for retrieval.</li>
  <li><strong>User Access:</strong> Users can fetch diagnostics reports for their vehicles at any time to monitor the health of their car.</li>
</ol>

<h2>Architecture & Services</h2>
<ul>
  <li><strong>Modular Services:</strong> Separate services for users, vehicles, OBD, and diagnostics.</li>
  <li><strong>Event Bus:</strong> Services communicate asynchronously through an event bus to maintain decoupling.</li>
  <li><strong>Rule Engine:</strong> Evaluates OBD readings and computes confidence scores for failures.</li>
  <li><strong>AI Integration:</strong> Uses <code>groq/compound</code> to analyze confidence scores and generate predictive insights.</li>
  <li><strong>Database:</strong> Stores OBD readings and diagnostics reports for future retrieval.</li>
</ul>

<h2>Key Features</h2>
<ul>
  <li>Real-time OBD-II data collection and monitoring</li>
  <li>Rule-based detection of potential failures</li>
  <li>AI-powered diagnostics with confidence scores and predicted failing parts</li>
  <li>Event-driven architecture for scalable and decoupled services</li>
  <li>Modular design allowing easy addition of new services and features</li>
  <li>Historical diagnostics storage and retrieval for user vehicles</li>
</ul>

<h2>Technologies Used</h2>
<ul>
  <li>Node.js & Express.js for backend services</li>
  <li>MongoDB & Mongoose for data storage and modeling</li>
  <li>Groq/Compound for AI-assisted diagnostics</li>
  <li>Event Bus for inter-service communication</li>
  <li>OBD-II protocol for vehicle sensor data collection</li>
</ul>

<h2>Getting Started</h2>
<pre><code>
// Clone the repository
git clone https://github.com/SankalpPimpalkar/SVHMS.git

// Navigate into project
cd svhms

// Install dependencies
npm install

// Configure environment variables
cp .env.example .env
// Set MongoDB URI and AI API keys

// Start the server
npm run dev
</code></pre>

<h2>Usage</h2>
<ul>
  <li>Register a user account and log in.</li>
  <li>Register a vehicle for the user.</li>
  <li>Connect the vehicle's OBD module to start sending OBD-II data.</li>
  <li>Backend computes failure confidence scores and feeds them to the AI model.</li>
  <li>Diagnostics are saved in the database and can be retrieved via API.</li>
</ul>

<h2>Future Enhancements</h2>
<ul>
  <li>Fleet management dashboard for multiple vehicles</li>
  <li>Predictive maintenance analytics using historical OBD data</li>
  <li>Mobile application for real-time alerts and notifications</li>
  <li>Support for additional vehicle makes and advanced sensor integration</li>
</ul>

<h2>License</h2>
<p>
MIT License © 2026
</p>
