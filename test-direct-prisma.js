// Direct Prisma test with forced environment reload
const fs = require('fs');
const path = require('path');

// Force reload environment variables
delete require.cache[require.resolve('dotenv')];
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testPrismaDirectly() {
    console.log('🧪 Direct Prisma Test (bypassing cached env)\n');
    
    // Read .env file directly to verify
    const envFile = fs.readFileSync('.env', 'utf8');
    const dbUrlMatch = envFile.match(/DATABASE_URL=(.+)/);
    const actualUrl = dbUrlMatch ? dbUrlMatch[1] : 'NOT FOUND';
    
    console.log('📋 Environment Status:');
    console.log('- DATABASE_URL from .env file:', actualUrl.substring(0, 50) + '...');
    console.log('- Starts with accelerate.prisma-data.net:', actualUrl.includes('accelerate.prisma-data.net'));
    
    // Force set the environment variable
    process.env.DATABASE_URL = actualUrl;
    console.log('- Environment variable forced to correct value ✅\n');
    
    try {
        console.log('🔄 Testing Prisma with correct URL...');
        
        // Import fresh Prisma client
        const { PrismaClient } = require('./generated/prisma/edge');
        const { withAccelerate } = require('@prisma/extension-accelerate');
        
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: actualUrl
                }
            }
        }).$extends(withAccelerate());
        
        console.log('✅ Prisma client created with correct URL');
        
        // Test connection
        console.log('🔄 Testing database connection...');
        await prisma.$connect();
        console.log('✅ Database connection successful!');
        
        // Test table creation/query
        console.log('🔄 Testing table operations...');
        
        // Simple test query
        const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
        console.log('✅ Database query successful:', result);
        
        // Test our actual table structure
        console.log('🔄 Testing playlist data table...');
        
        const testRecord = await prisma.playlistData.upsert({
            where: { playlistId: 'test-connection-2024' },
            update: { 
                data: { 
                    test: 'connection-test', 
                    timestamp: new Date().toISOString(),
                    success: true
                } 
            },
            create: { 
                playlistId: 'test-connection-2024',
                data: { 
                    test: 'connection-test', 
                    timestamp: new Date().toISOString(),
                    success: true
                }
            }
        });
        
        console.log('✅ CRUD operations successful! Record ID:', testRecord.id);
        
        // Read it back
        const readBack = await prisma.playlistData.findUnique({
            where: { playlistId: 'test-connection-2024' }
        });
        
        console.log('✅ Read back successful:', readBack.data.test);
        
        // Clean up
        await prisma.playlistData.delete({
            where: { id: testRecord.id }
        });
        
        console.log('✅ Cleanup successful');
        
        await prisma.$disconnect();
        
        console.log('\n🎉 PRISMA IS WORKING PERFECTLY! 🎉');
        console.log('✅ Database connection: SUCCESS');
        console.log('✅ Table operations: SUCCESS');
        console.log('✅ CRUD operations: SUCCESS');
        console.log('\n🚀 Ready to deploy with global database updates!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        
        if (error.code === 'P2021') {
            console.log('\n💡 Table does not exist - need to create schema');
            console.log('Run: npx prisma db push');
        } else if (error.message.includes('fetch failed')) {
            console.log('\n💡 Network connectivity issue');
            console.log('Check: Prisma Accelerate service status');
        } else {
            console.log('\nFull error:', error);
        }
    }
    
    process.exit();
}

testPrismaDirectly();