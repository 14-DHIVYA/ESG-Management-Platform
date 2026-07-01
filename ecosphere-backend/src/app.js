const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ success: true, message: 'EcoSphere API is running' }));

app.use('/api/auth', require('./modules/auth/routes'));
app.use('/api/employees', require('./modules/employees/routes'));
app.use('/api/departments', require('./modules/departments/routes'));
app.use('/api/categories', require('./modules/categories/routes'));
app.use('/api/emission-factors', require('./modules/emissionFactors/routes'));
app.use('/api/products', require('./modules/products/routes'));
app.use('/api/environmental-goals', require('./modules/environmentalGoals/routes'));
app.use('/api/esg-policies', require('./modules/esgPolicies/routes'));
app.use('/api/badges', require('./modules/badges/routes'));
app.use('/api/rewards', require('./modules/rewards/routes'));
app.use('/api/carbon-transactions', require('./modules/carbonTransactions/routes'));
app.use('/api/csr-activities', require('./modules/csrActivities/routes'));
app.use('/api/employee-participation', require('./modules/employeeParticipation/routes'));
app.use('/api/challenges', require('./modules/challenges/routes'));
app.use('/api/challenge-participation', require('./modules/challengeParticipation/routes'));
app.use('/api/policy-acknowledgements', require('./modules/policyAcknowledgements/routes'));
app.use('/api/audits', require('./modules/audits/routes'));
app.use('/api/compliance-issues', require('./modules/complianceIssues/routes'));
app.use('/api/department-scores', require('./modules/departmentScores/routes'));
app.use('/api/diversity-metrics', require('./modules/diversityMetrics/routes'));
app.use('/api/training-completions', require('./modules/trainingCompletions/routes'));
app.use('/api/reward-redemptions', require('./modules/rewardRedemptions/routes'));
app.use('/api/notifications', require('./modules/notifications/routes'));
app.use('/api/esg-config', require('./modules/config/routes'));
app.use('/api/reports', require('./modules/reports/routes'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
