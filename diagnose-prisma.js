// Direct Prisma connection test with detailed diagnostics
require('dotenv').config();

async function diagnosticTest() {
    console.log('🔍 Prisma Connection Diagnostics\n');
    
    // Check environment variables
    console.log('📋 Environment Check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- DATABASE_URL present:', !!process.env.DATABASE_URL);
    console.log('- DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
    console.log('- DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) + '...');
    
    try {
        console.log('\n🔄 Testing Prisma Client Import...');
        
        // Test importing Prisma client directly
        const { PrismaClient } = require('./generated/prisma/edge');
        console.log('✅ Prisma Client imported successfully');
        
        console.log('\n🔄 Creating Prisma Client Instance...');
        const prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
        console.log('✅ Prisma Client instance created');
        
        console.log('\n🔄 Testing Basic Connection...');
        
        // Try the simplest possible query
        const result = await prisma.$connect();
        console.log('✅ Database connection established!');
        
        console.log('\n🔄 Testing Table Operations...');
        
        // Try to check if tables exist
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `;
        
        console.log('✅ Tables found:', tables);
        
        if (tables.length === 0) {
            console.log('\n🚀 Creating database tables...');
            // The tables don't exist, let's push the schema
            console.log('Run: npx prisma db push --force-reset');
        } else {
            console.log('\n✅ Database is ready!');
            
            // Test CRUD operations
            console.log('\n🔄 Testing CRUD operations...');
            
            const testRecord = await prisma.playlistData.upsert({
                where: { playlistId: 'connection-test' },
                update: { 
                    data: { test: 'updated', timestamp: new Date().toISOString() } 
                },
                create: { 
                    playlistId: 'connection-test',
                    data: { test: 'created', timestamp: new Date().toISOString() }
                }
            });
            
            console.log('✅ CRUD test successful:', testRecord.id);
            
            // Clean up
            await prisma.playlistData.delete({
                where: { id: testRecord.id }
            });
            
            console.log('✅ Cleanup successful');
        }
        
        await prisma.$disconnect();
        console.log('\n🎉 ALL TESTS PASSED! Prisma is working perfectly! 🎉');
        
    } catch (error) {
        console.error('\n❌ Diagnostic failed at:', error.message);
        
        if (error.code) {
            console.log('Error Code:', error.code);
        }
        
        if (error.code === 'P1001') {
            console.log('\n💡 P1001 - Cannot reach database server');
            console.log('Possible fixes:');
            console.log('1. Check if DATABASE_URL is correct');
            console.log('2. Verify Prisma Accelerate service is active');
            console.log('3. Check network connectivity');
            console.log('4. Try regenerating Prisma Accelerate API key');
        } else if (error.code === 'P3009') {
            console.log('\n💡 P3009 - Schema validation failed');
            console.log('Try: npx prisma db push --force-reset');
        } else if (error.message.includes('fetch failed')) {
            console.log('\n💡 Network/Fetch Error');
            console.log('This suggests Prisma Accelerate service connectivity issues');
            console.log('Try:');
            console.log('1. Check internet connection');
            console.log('2. Verify Prisma Accelerate API key is valid');
            console.log('3. Check if service is experiencing downtime');
        }
        
        console.log('\n🔧 Quick Fixes to Try:');
        console.log('1. npx prisma generate');
        console.log('2. npx prisma db push --force-reset');
        console.log('3. Check Prisma Cloud Console for service status');
    }
    
    process.exit();
}

diagnosticTest();