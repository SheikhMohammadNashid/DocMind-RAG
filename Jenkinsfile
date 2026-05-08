pipeline {
    agent any

    environment {
        DOCKER_USER = "sheikhnashid"
        STG_USER = "stg"
        PROD_USER = "prod"
        STAGING_IP = "192.168.0.179"
        PROD_IP = "192.168.0.161"
        DOCKER_CREDS_ID = "docker-hub-creds"
        SSH_CREDS_ID = "vm-deploy-key"
        TAG = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Build & Push') {
            steps {
                script {
                    withCredentials([
                        usernamePassword(
                            credentialsId: DOCKER_CREDS_ID,
                            usernameVariable: 'USER',
                            passwordVariable: 'PASS'
                        )
                    ]) {
                        sh 'echo $PASS | docker login -u $USER --password-stdin'

                        // Fixed: Added space before the context path (.)
                        sh "docker build -t ${DOCKER_USER}/docmind-rag-frontend:v${TAG} ./frontend"
                        sh "docker push ${DOCKER_USER}/docmind-rag-frontend:v${TAG}"

                        sh "docker build -t ${DOCKER_USER}/docmind-rag-backend:v${TAG} ./backend"
                        sh "docker push ${DOCKER_USER}/docmind-rag-backend:v${TAG}"
                    }
                }
            }
        }

        stage('Deploy to Production') {
            steps {
                sshagent([SSH_CREDS_ID]) {
                    script {
                        echo "Deploying to Production VM..."

                        // Copy compose file (Changed VM_USER to PROD_USER)
                        sh "scp -o StrictHostKeyChecking=no docker-compose.prod.yml ${PROD_USER}@${PROD_IP}:~/docker-compose.yml"

                        // Remote deployment
                        sh """
                        ssh -o StrictHostKeyChecking=no ${PROD_USER}@${PROD_IP} '
                            export TAG=${TAG}
                            export DOCKER_USER=${DOCKER_USER}

                            docker compose down
                            docker compose pull
                            docker compose up -d
                        '
                        """
                    }
                }
            }
        }
    }
}
