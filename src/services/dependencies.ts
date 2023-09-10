import { chunk, forEach, memoize, orderBy, uniqBy } from "lodash";
import { Dependency, GithubRepo } from "../types";
import * as Axios from "axios";

const client = Axios.default.create({
    baseURL: "https://api.npms.io/v2",
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
    },
});

const getPackagesMetaData = memoize(async (packages: string[]) => {
    try {
        const npmDataPromises = chunk(packages, 200).map(
            async (depChunk, idx) => {
                const key = `fetching metadata - chunk ${idx} - ${depChunk.length} packages`
                console.time(key);
                const response = await client.post("/package/mget", depChunk);

                console.timeEnd(key);
                return response.data;
            },
        );
        const npmData = await Promise.all(npmDataPromises);

        return npmData.reduce((d, e) => ({ ...d, ...e }), {});
    } catch (ex) {
        console.error(ex);
    }

    return {};
});

export const getDependencies = async (repos: GithubRepo[]) => {
    const dependencies: Record<string, Dependency> = {};

    const initializeDependency = (name: string) => {
        if (!dependencies[name]) {
            dependencies[name] = {
                name,
                count: 0,
                instances: [],
                devCount: 0,
            };
        }
    };

    const parseDependencyList = (
        repo: GithubRepo,
        depsList: Record<string, string>,
        options: { isDev: boolean },
    ) => {
        const packages = Object.keys(depsList);

        packages.forEach((d) => {
            initializeDependency(d);

            if (options.isDev) {
                dependencies[d].devCount += 1;
            } else {
                dependencies[d].count += 1;
            }
            dependencies[d].instances.push({
                repo: repo.name,
                dev: options.isDev,
                version: depsList[d],
            });
        });
    };

    repos.map((r) => {
        if (!r.packageJsons) {
            return;
        }
        Object.keys(r.packageJsons).map(async (ws) => {
            parseDependencyList(r, r.packageJsons[ws].dependencies || {}, {
                isDev: false,
            });

            parseDependencyList(r, r.packageJsons[ws].devDependencies || {}, {
                isDev: true,
            });
        });
    });

    const packagesMetadata = await getPackagesMetaData(
        Object.keys(dependencies),
    );

    forEach(packagesMetadata, (packageMetadata, name) => {
        dependencies[name].metadata = packageMetadata;
    });

    const deps = Object.values(dependencies);

    deps.forEach((d) => {
        const uniqInstances = uniqBy(d.instances, (i) => [i.version, i.repo]);
        d.instances = orderBy(uniqInstances, (i) => i.version, "asc");
    });

    return deps;
};
