import { ponder } from '@/generated';

ponder.on('FrontendGateway:FrontendCodeRegistered', async ({ event, context }) => {
    const { FrontendCodeRegistered, FrontendCodeMapping } = context.db;
    const { owner, frontendCode } = event.args;

    // flat indexing
    await FrontendCodeRegistered.create({
        id: `${owner}-${event.block.number.toString()}`,
        data: {
            owner,
            frontendCode,
        },
    });

    await FrontendCodeMapping.upsert({
        id: owner,
        create: {
            frontendCodes: [frontendCode],
        },
        update: (c) => ({
            frontendCodes: [...c.current.frontendCodes, frontendCode],
        }),
    });
});

ponder.on('FrontendGateway:FrontendCodeTransferred', async ({ event, context }) => {
    const { FrontendCodeRegistered, FrontendCodeMapping } = context.db;
    const { from, to, frontendCode } = event.args;

    // flat indexing
    await FrontendCodeRegistered.create({
        id: `${to}-${event.block.number.toString()}`,
        data: {
            owner: to,
            frontendCode,
        },
    });

    await FrontendCodeMapping.upsert({
        id: from,
        create: {
            frontendCodes: [],
        },
        update: (c) => ({
            frontendCodes: c.current.frontendCodes.filter((code) => code !== frontendCode),
        }),
    });

    await FrontendCodeMapping.upsert({
        id: to,
        create: {
            frontendCodes: [frontendCode],
        },
        update: (c) => ({
            frontendCodes: [...c.current.frontendCodes, frontendCode],
        }),
    });
});