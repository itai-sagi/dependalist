export interface GithubRepo {
    name: string;
    language: string;
    archived: boolean;
    contents_url: string;
    html_url: string;
    packageJsons: Record<string, any>;
    dockerImages: string[];
    nvmrcNodeVersion?: string;
    pushed_at: string;
};

export interface Dependency {
    name: string;
    count: number;
    instances: {
        repo: string;
        version: string;
        dev: boolean;
    }[];
    devCount: number;
    metadata?: any;
}