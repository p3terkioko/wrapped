// Test script to verify Prisma connection
require('dotenv').config();

async function testPrisma() {
    try {
        console.log('🔄 Testing Prisma connection...');
        console.log('Database URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Missing ❌');
        
        // Try to import Prisma client from generated location
        const { PrismaClient } = require('./generated/prisma/edge');
        const { withAccelerate } = require('@prisma/extension-accelerate');
        
        const prisma = new PrismaClient().$extends(withAccelerate());
        
        console.log('✅ Prisma client created successfully');
        
        // Try a simple query
        console.log('🔄 Testing database connection...');
        
        // Test connection with a simple raw query
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database connection successful:', result);
        
        // Test creating tables
        console.log('🔄 Testing table operations...');
        
        // Try to find or create a test record
        const testData = {
            playlistId: 'test-playlist',
            data: { test: 'data' }
        };
        
        const saved = await prisma.playlistData.upsert({
            where: { playlistId: 'test-playlist' },
            update: testData,
            create: testData
        });
        
        console.log('✅ Database operations successful:', saved.id);
        
        // Clean up test data
        await prisma.playlistData.delete({
            where: { playlistId: 'test-playlist' }
        });
        
        console.log('✅ Prisma setup is working perfectly! 🎉');
        
    } catch (error) {
        console.error('❌ Prisma test failed:', error.message);
        console.error('Full error:', error);
        
        if (error.code === 'P1001') {
            console.log('\n💡 Suggestions:');
            console.log('1. Check if DATABASE_URL is correct in .env');
            console.log('2. Verify Prisma Accelerate connection is active');
            console.log('3. Try running: npx prisma studio (to test connection)');
        }
    } finally {
        process.exit();
    }
}

testPrisma();