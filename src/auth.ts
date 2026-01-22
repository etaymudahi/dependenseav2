import rc from 'rc';
import registryAuthToken from 'registry-auth-token';

export const getAuthToken = (registryUrl: string): string | undefined => {
    // Load npm config using 'rc'. This reads .npmrc files.
    // We pass 'npm' as the appname to load .npmrc files.
    const npmConfig = rc('npm', { registry: 'https://registry.npmjs.org/' });
    
    // Get the auth token for the specific registry URL
    // The registry-auth-token package handles the logic of finding the right token
    // based on scoped registries or the default registry in the config.
    const tokenInfo = registryAuthToken(registryUrl, { npmrc: npmConfig });
    
    return tokenInfo ? tokenInfo.token : undefined;
};
