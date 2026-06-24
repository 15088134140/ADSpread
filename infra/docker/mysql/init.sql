-- ADSpread Database Initialization Script
-- This script runs on first MySQL container creation

-- Set character set
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Create database if not exists (handled by docker-compose environment variable)
-- CREATE DATABASE IF NOT EXISTS adspread DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE adspread;

-- Create default admin user (password: admin123)
-- This will be handled by Prisma migrations and seed script

SET FOREIGN_KEY_CHECKS = 1;
