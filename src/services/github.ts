import * as Axios from "axios";
import * as File from "fs";
import { GithubRepo } from "../types";
import { uniqBy } from "lodash";

const { GITHUB_TOKEN, GITHUB_ORG } = process.env;
if (!GITHUB_TOKEN) {
    throw new Error("No GITHUB_TOKEN, please provide it as env variable");
}

if (!GITHUB_ORG) {
    throw new Error("No GITHUB_ORG, please provide it as env variable");
}

const client = Axios.default.create({
    baseURL: "https://api.github.com/",
    headers: {
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
    },
});

let repos: GithubRepo[] = [];

const supportedLanguages = ["typescript", "javascript"];

export const fetchRepos = async (): Promise<GithubRepo[]> => {
    let page = 1;
    let response = await client.get(`/orgs/${GITHUB_ORG}/repos`, {
        params: { type: "private", per_page: 100, page },
    });
    repos = [...repos, ...response.data];

    while (response.data.length === 100) {
        page++;
        response = await client.get("/orgs/vnatures/repos", {
            params: { type: "private", per_page: 100, page },
        });
        repos = [...repos, ...response.data];
    }

    const filtererdRepos = repos.filter(
        (r) =>
            !r.archived &&
            supportedLanguages.includes((r.language || "").toLowerCase()),
    );

    repos = uniqBy(filtererdRepos, (r) => r.name);

    return repos;
};

export const getRepos = async (): Promise<GithubRepo[]> => {
    return repos;
};

const getFileContents = async (contentsUrl: string, path: string) => {
    try {
        const file = await client.get(contentsUrl.replace("{+path}", path));
        return new Buffer(file.data.content, "base64").toString();
    } catch (ex) {}
    return;
};

const repoDepsPath = (repo: GithubRepo) => `./deps/${repo.name}`;

export const retrieveDependencies = async (repo: GithubRepo) => {
    try {
        if (File.existsSync(repoDepsPath(repo))) {
            console.log(`${repo.name} found - skipping.`);
            return;
        }
        console.log(`${repo.name} not found - downloading.`);

        File.mkdirSync(repoDepsPath(repo), { recursive: true });

        const [packageJsonContents, nvmrc, dockerfile] = await Promise.all([
            getFileContents(repo.contents_url, "package.json"),
            getFileContents(repo.contents_url, ".nvmrc"),
            getFileContents(repo.contents_url, "Dockerfile"),
        ]);

        if (!packageJsonContents) {
            return;
        }

        File.writeFileSync(
            `./deps/${repo.name}/package.json`,
            packageJsonContents,
        );

        if (nvmrc) {
            File.writeFileSync(`./deps/${repo.name}/.nvmrc`, nvmrc);
        }

        if (dockerfile) {
            File.writeFileSync(`./deps/${repo.name}/Dockerfile`, dockerfile);
        }

        const packageJson = JSON.parse(packageJsonContents);
        if (packageJson.workspaces && packageJson.workspaces.length > 0) {
            const promises = packageJson.workspaces.map(async (ws: string) => {
                try {
                    const wsPackageJsonContents = await getFileContents(
                        repo.contents_url,
                        `${ws}/package.json`,
                    );

                    File.writeFileSync(
                        `./deps/${repo.name}/${ws}-package.json`,
                        wsPackageJsonContents,
                    );
                } catch (ex) {
                    console.error(
                        `Failed fetching package.json, repo=${repo.name}, ws=${ws}`,
                    );
                }
            });

            await Promise.all(promises);
        }
    } catch (ex) {
        console.error(`Failed fetching package.json, ${repo.name}`);
    }
};

const enrichRepos = (repos: GithubRepo[]) => {
    repos.forEach((r) => {
        const files = File.readdirSync(repoDepsPath(r));
        r.dockerImages = [];
        r.packageJsons = {};

        const dockerfile = files.find((f) => f === "Dockerfile");
        if (dockerfile) {
            const dockerfileContents = File.readFileSync(
                repoDepsPath(r) + "/" + dockerfile,
            ).toString();
            const imagesUsed = dockerfileContents
                .split("\n")
                .filter((l) => l.includes("FROM "));

            r.dockerImages = imagesUsed.map(
                (img) => img.replace("FROM ", "").split(" as")[0],
            );
        }

        const nvmrc = files.find((f) => f === ".nvmrc");
        if (nvmrc) {
            const nodeVersion = File.readFileSync(
                repoDepsPath(r) + "/" + nvmrc,
            ).toString();
            r.nvmrcNodeVersion = nodeVersion;
        }

        files
            .filter((f) => f.endsWith(".json"))
            .forEach((f) => {
                const ws = f.split("-")[0] || "main";
                r.packageJsons[ws] = JSON.parse(
                    File.readFileSync(repoDepsPath(r) + "/" + f).toString(),
                );
            });
    });
}

const downloadPackageJsons = async () => {
    const githubRepos = await fetchRepos();

    await Promise.all(githubRepos.map((r) => retrieveDependencies(r)));

    await enrichRepos(githubRepos);

    repos = githubRepos;
};

void downloadPackageJsons();
