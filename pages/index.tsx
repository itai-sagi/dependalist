import React, { useState } from "react";
import { getRepos } from "../src/services/github";
import { Radio, Table } from "antd";
import { Dependency, GithubRepo } from "../src/types";
import { getDependencies } from "../src/services/dependencies";

const depsColumns = [
    {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: (a: Dependency, b: Dependency) => a.name.localeCompare(b.name),
        render: (_, record: Dependency) => (
            <a
                href={`https://npmjs.com/package/${record.name}`}
                target="_blank"
            >
                {record.name}
            </a>
        ),
    },
    {
        title: "Count",
        dataIndex: "count",
        key: "count",
        sorter: (a: Dependency, b: Dependency) => a.count - b.count,
    },
    {
        title: "Dev Count",
        dataIndex: "devCount",
        key: "devCount",
        sorter: (a: Dependency, b: Dependency) => a.devCount - b.devCount,
    },
];

const reposColumns = [
    {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: (a: GithubRepo, b: GithubRepo) => a.name.localeCompare(b.name),
        render: (_, record: GithubRepo) => (
            <a href={record.html_url} target="_blank">
                {record.name}
            </a>
        ),
    },
    {
        title: "Docker images used",
        dataIndex: "dockerImages",
        key: "dockerImages",
        sorter: (a: GithubRepo, b: GithubRepo) =>
            a.dockerImages.join(",").localeCompare(b.dockerImages.join(",")),
        render: (_, record: GithubRepo) => record.dockerImages.join(", "),
    },
    {
        title: ".nvmrc version",
        dataIndex: "nvmrcNodeVersion",
        key: "nvmrcNodeVersion",
        sorter: (a: GithubRepo, b: GithubRepo) =>
            (a.nvmrcNodeVersion || "").localeCompare(b.nvmrcNodeVersion || ""),
    },
];

enum Mode {
    Repos = "repos",
    Deps = "deps",
}

const Home: React.FC = (props: {
    dependencies: Dependency[];
    repos: GithubRepo[];
}) => {
    const [mode, setMode] = useState(Mode.Deps);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                padding: 50,
            }}
        >
            <Radio.Group
                options={[
                    { label: "Dependencies", value: Mode.Deps },
                    { label: "Repositories", value: Mode.Repos },
                ]}
                onChange={(e) => setMode(e.target.value)}
                value={mode}
            />

            {(mode === Mode.Deps && (
                <Table
                    dataSource={props.dependencies}
                    columns={depsColumns}
                    rowKey={(record) => record.name}
                    pagination={{ pageSize: 100 }}
                    expandable={{
                        expandedRowRender: (record) => (
                            <div>
                                <h2>{record.name}</h2>
                                {record.metadata && (
                                    <React.Fragment>
                                        <h3>
                                            {
                                                record.metadata.collected
                                                    ?.metadata.description
                                            }
                                        </h3>
                                        <p>
                                            Latest version:{" "}
                                            {
                                                record.metadata.collected
                                                    ?.metadata.version
                                            }
                                        </p>
                                    </React.Fragment>
                                )}
                                {record.instances.map((i) => (
                                    <p style={{ margin: 0 }} key={i.repo}>
                                        {i.repo} - {i.version}
                                    </p>
                                ))}
                            </div>
                        ),
                        defaultExpandAllRows: false,
                        expandRowByClick: true,
                        rowExpandable: (record) =>
                            record.name !== "Not Expandable",
                    }}
                />
            )) ||
                null}
            {(mode === Mode.Repos && (
                <Table
                    dataSource={props.repos}
                    columns={reposColumns}
                    rowKey={(record) => record.name}
                    pagination={{ pageSize: 100 }}
                />
            )) ||
                null}
        </div>
    );
};

export async function getServerSideProps() {
    const repos = await getRepos();
    const dependencies = await getDependencies(repos);

    return {
        props: {
            dependencies,
            repos,
        },
    };
}
export default Home;
